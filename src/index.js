const fs = require("fs");
const path = require("path");
const { v4: uuidv4 } = require("uuid");

const srcDir = "./data";
const destDir = "./dest";

let nonMigrated = [];
let tmpPointer = {};

function run(rawArg) {
  // this will use console.log excessively, since ideally it will only ever be run once.
  console.log("Begginning migration.");
  try {

    // first lets get a list of files, from our data dir.
    fs.readdirSync(srcDir).forEach(file => {
      // now we will have a loop of each and every file within the dir.
      // which will additionally include directories. so we need to filter these.
      if (!fs.stats.isDirectory()) {
        let data = fs.readFileSync(`${srcDir}${path.sep}${file}`, {encoding:"utf8"});

        // ensure we were able to get data.
        if (data) {
          data = JSON.parse(data);
          // we know since the archiver conterted names to be URL safe, we want the name based
          // off the package name itself.
          let fileName = data.name;
          // now we have the file contents as a JS Obj = data, and the file name.

          // now we want to check that this is allowed to be migrated.
          let nameValidity = valid_name(fileName);

          if (nameValidity.ok) {

            let packValidity = valid_data(data);

            if (packValidity.ok) {

              // Now to create any custom fields that don't exist otherwise.

              // created, updated, star_gazers,
              const cur = Date.now();

              data.created = cur;
              data.updated = cur;
              data.star_gazers = [];
              data.migrated = true;

              // we are adding the current epoch date, in ms as the created and updated time.
              // additionally setting up the empty array of star_gazers.
              // then finally a flag to indicate that this package was migrated.
              // But now that the file is setup, we need to save the package content.

              let id = uuidv4();

              // now to write the package under this new name, and save its contents to the
              // package pointer.
              fs.writeFileSync(`${destDir}${path.sep}packages${path.sep}${id}.json`, JSON.parse(data));

              // now to add to package pointer.
            } else {
              nonMigrated.push({ name: fileName, reason: packValidity.reason});
            }
          } else {
            // the file did not pass the check. Lets add it to an array, to display later.
            nonMigrated.push({ name: fileName, reason: nameValidity.reason});
          }
        } else {
          nonMigrated.push({ name: file, reason: "Unable to retreive contents"});
        }
      } // else this is a directory
    });

  } catch(err) {
    console.error(err);
    process.exit(1);
  }

}

function valid_name(name) {
  let escapeName = encodeURIComponent(name);

  if (escapeName !== name) {
    // checks for strict equality, with the name field within the file.
    return { ok: false, reason: "Non-URL Safe name." };
  }

  // other checks
  return { ok: true };
}

function valid_data(data) {
  return { ok: true };
}

module.exports = {
  run,
};
