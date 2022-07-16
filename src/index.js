const fs = require("fs");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const axios = require("axios");

const srcDir = "./data";
const destDir = "./dest";

let nonMigrated = [];
let tmpPointer = {};

async function run(rawArg) {
  // this will use console.log excessively, since ideally it will only ever be run once.
  console.log("Begginning migration.");

  // before we start the migration, lets make sure our folders exist.
  fs.mkdirSync(`${destDir}${path.sep}packages${path.sep}`, { recursive: true });

  try {

    const files = fs.readdirSync(srcDir);

    for (const file of files) {
      let stats = fs.lstatSync(`${srcDir}${path.sep}${file}`);
      if (!stats.isDirectory()) {
        let data = fs.readFileSync(`${srcDir}${path.sep}${file}`, {encoding: "utf8"});

        if (data) {
          data = JSON.parse(data);
          let fileName = data.name;
          let nameValidity = await valid_name(fileName);
          if (nameValidity.ok) {
            valid_data(data)
              .then((res) => {
                const cur = Date.now();
                data.created = cur;
                data.updated = cur;
                data.star_gazers = [];
                data.migrated = true;

                let id = uuidv4();

                fs.writeFileSync(`${destDir}${path.sep}packages${path.sep}${id}.json`, JSON.stringify(data, null, 4));
                console.log(`Successfully wrote: ${fileName}`);
                // now to add to package pointer.
                tmpPointer[fileName] = `${id}.json`;
                // this assigns its key in the tmp pointer.

                finish();
              })
              .catch((err) => {
                nonMigrated.push({ name: fileName, reason: err.reason});
                finish();
              });

          } else {
            // nameValidity failed.
            nonMigrated.push({ name: fileName, reason: nameValidity.reason});
            finish();
          }
        }
      }
    }
  } catch(err) {
    console.error(err);
    process.exit(1);
  }

}

async function finish() {
  console.log("Finishing...");
  fs.writeFileSync(`${destDir}${path.sep}package_pointer.json`, JSON.stringify(tmpPointer, null, 4));
  console.log("Successfully wrote package_pointer.json");
  fs.writeFileSync(`${destDir}${path.sep}non_migrated.json`, JSON.stringify(nonMigrated, null, 4));
  console.log("Successfully wrote non_migrated.json");
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
    // checks for strict equality, with the name field within the file.
    return { ok: false, reason: "Non-URL Safe name." };
  }

  for (let i = 0; i < bannedNames.length; i++) {
    if (name == bannedNames[i]) {
      return { ok: false, reason: "Name is banned for upload." };
    }
  }
  // other checks
  return { ok: true };
}

function valid_data(data) {
  return new Promise(function (resolve, reject) {
    // check that its available on GH
    axios.get(data.repository.url)
      .then(function (res) {
        resolve({ ok: true });
      })
      .catch(function (err) {
        if (err.response.status == 404) {
          reject({ ok: false, reason: "Package is no Longer Available" });
        } else {
          reject({ ok: false, reason: "AN unkown error occured during retrevial" });
        }
      });
  });
}

module.exports = {
  run,
};
