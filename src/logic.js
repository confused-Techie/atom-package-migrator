const fs = require("fs");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const axios = require("axios");

const { user_name, token } = require("./config.js");

const srcDir = "./data";
const destDir = "./dest";

let nonMigrated = [];
let tmpPointer = {};

let totalFiles = 0;
let currentFile = 0;

const gen_token = `${user_name}:${token}`;
const encodedToken = Buffer.from(gen_token).toString('base64');

async function run(rawArg) {
  console.log("Begginning Migration...");

  fs.mkdirSync(`${destDir}${path.sep}packages${path.sep}`, { recursive: true });

  try {
    const files = fs.readdirSync(srcDir);
    totalFiles = files.length;

    for await (const file of files) {
      try {
        currentFile++;

        await delay(1500); // If each package takes 1 second to handle, this would allow 2400 packages
        // to be handled per second. Now that does get very close to the authenticated user 5000 request limit
        // but should avoid it, as that would be 2500 packages, or otherwise 5000 api calls.
        // Although I will still build in a method to help prevent reaching our limit below.
        await handleFile(file);

        // now to call our finish method, to see if we should write the package pointer, and nonMigrated list.
        await finish();

      } catch(err) {
        console.error(`Severe Mid-Loop Caught Error: ${err}`);
        console.log('Attempting to save progress and exit');
        await finish(true);
      }

    }

  } catch(err) {
    console.log(`Severe error: ${err}`);
    process.exit(1);
  }
}

async function delay(ms) {
  return await new Promise(resolve => setTimeout(resolve, ms));
}

async function handleFile(file) {
  let stats = fs.lstatSync(`${srcDir}${path.sep}${file}`);

  if (!stats.isDirectory()) {
    let rawdata = fs.readFileSync(`${srcDir}${path.sep}${file}`, { encoding: "utf8"});
    let data = JSON.parse(rawdata);

    if (data) {
      let fileName = data.name;
      //let nameValidity = await valid_name(fileName);
      //let packageValidity = await valid_pack(data);
      //let tagData = await getTags(data);

      let nameValidity;
      let packageValidity;
      let tagData;

      try {
        nameValidity = await valid_name(fileName);
        packageValidity = await valid_pack(data);
        tagData = await getTags(data);
      } catch(err) {
        console.error(`Failure occured during HTTP calls. Attempting Recovery.`);
        if (!nameValidity) { nameValidity = { ok: false, reason: `Unknown HTTP error ${err}`}};
        if (!packageValidity) { packageValidity = { ok: false, reason: `Unknown HTTP error ${err}`}};
        if (!tagData) { tagData = { ok: false, reason: `Unkown HTTP error ${err}`}};
      }

      let id = uuidv4();

      if (nameValidity.ok && packageValidity.ok && tagData.ok) {
        // now time to create custom vars for the pack.
        let dataToWrite = await createPack(data, tagData);
        // first we can add the easy ones.


        // once the tag data is added into the actual data, lets now write the package.

        fs.writeFileSync(`${destDir}${path.sep}packages${path.sep}${id}.json`, JSON.stringify(dataToWrite, null, 4));

        console.log(`Successfully wrote: ${fileName}`);

        // add the data to the tmpPointer
        tmpPointer[fileName] = `${id}.json`;

      } else {
        // add to nonMigrated
        if (nameValidity.reason) {
          nonMigrated.push({ name: fileName, reason: nameValidity.reason});
        } else if (packageValidity.reason) {
          nonMigrated.push({ name: fileName, reason: packageValidity.reason});
        } else if (tagData.reason) {
          nonMigrated.push({ name: fileName, reason: tagData.reason });
        } else {
          nonMigrated.push({ name: fileName, reason: "Unknown error occured when collecting name & package validity"});
        }
      }
    } else {
      // unable to read the package file contents successfully.
      nonMigrated.push({ name: file, reason: "Unable to read source file"});
    }
  } // else its a directory, ignore
}

async function createPack(data, tagData) {
  const time = Date.now();
  data.created = time;
  data.updated = time;
  data.star_gazers = [];
  data.creation_method = "Migrated from Atom.io";

  // now the hard part of adding in all the tag info.
  for (let i = 0; i < Object.keys(data.versions).length; i++) {
    // now one each version within our package data, lets find a matching version tag within the gh tags data
    for (let y = 0; y < tagData.content.length; y++) {
      let ver = Object.keys(data.versions)[i];
      if (tagData.content[y].name.replace("v", "") == ver) {
        // they match, stuff the data into the package.
        data.versions[ver].tarball_url = tagData.content[y].tarball_url;
        data.versions[ver].sha = tagData.content[y].commit.sha;
      }
    }
  }

  return data;
}

async function valid_name(name) {
  let escapeName = encodeURIComponent(name);

  const bannedNames = [
    "atom-pythoncompiler",
    "situs-slot-gacor",
    "slot-online-gacor",
    "slot88",
    "slot-gacor-hari-ini",
    "demo-slot-joker-gacor",
    "hoki-slot",
    "slot-bonus-new-member",
    "slot-dana",
    "slot-deposit-dana-100000",
    "slot-deposit-pulsa",
    "slot-hoki",
    "slot-paling-gacor-setiap-hari",
    "slot-pulsa",
    "slothoki",
    "slotonline"
  ];

  if (escapeName !== name) {
    return { ok: false, reason: "Non-URL Safe Name."};
  }

  for (let i = 0; i < bannedNames.length; i++) {
    if (name == bannedNames[i]) {
      return { ok: false, reason: "Name is banned for upload." };
    }
  }

  return { ok: true };
}

async function finish(override) {
  console.log(`Current: ${currentFile} - Total: ${totalFiles}`);
  if (currentFile == totalFiles || override) {
    console.log("Finishing...");
    fs.writeFileSync(`${destDir}${path.sep}package_pointer.json`, JSON.stringify(tmpPointer, null, 4));
    console.log("Successfully wrote package_pointer.json");
    fs.writeFileSync(`${destDir}${path.sep}non_migrated.json`, JSON.stringify(nonMigrated, null, 4));
    console.log("Successfully wrote non_migrated.json");
    console.log("Done...");
    process.exit(0);
  }
}

async function valid_pack(pack) {
  let axiosConfig = {
    method: 'get',
    url: pack.repository.url,
    headers: { 'Authorization': 'Basic '+ encodedToken }
  };

  try {
    const res = await axios(axiosConfig);
    return { ok: true };
  } catch(err) {
    if (err.response) {
      if (err.response.status == 404) {
        return { ok: false, reason: "Package is no longer available" };
      } else {
        return { ok: false, reason: `Error Occured During HTTP Request: ${err}` };
      }
    } else {
      return { ok: false, reason: `Error Occured during HTTP Request: ${err}`};
    }

  }
}

async function getTags(data) {
  let axiosConfig = {
    method: 'get',
    url: `https://api.github.com/repos/${data.repository.url.replace("https://github.com/", "")}/tags`,
    headers: { 'Authorization': 'Basic '+ encodedToken }
  };

  try {
    const res = await axios(axiosConfig);
    // now we want to check the status of our api rate limits.
    let rateLimitRemaining = res.headers['x-ratelimit-remaining'];
    let rateLimitMax = res.headers['x-ratelimit-limit'];
    let rateLimitUsed = res.headers['x-ratelimit-used'];
    let rateLimitReset = res.headers['x-ratelimit-reset'];

    if (rateLimitMax - rateLimitUsed < 20) {
      console.log(`Rate Limit Exceedded! ${rateLimitRemaining} - Reset: ${rateLimitReset}`);
      let time = Date.now();
      let timeToWait = (rateLimitReset*1000) - time;
      // multiplying here ^^^, since rateLimitReset is in epoch times seconds
      console.log(`Rate Limit Hit. Waiting ${timeToWait}ms until rate limit lifted.`);
      await delay(timeToWait);
    } else {
      console.log(`Rate Limit - Used: ${rateLimitUsed} - Remaining: ${rateLimitRemaining}`);
    }
    return { ok: true, content: res.data };
  } catch(err) {
    if (err.response.status == 404) {
      return { ok: false, reason: "Package Tags are not avialable" };
    } else {
      return { ok: false, reason: `Error Occured During HTTP Request: ${err}`};
    }
  }
}

module.exports = {
  run,
};
