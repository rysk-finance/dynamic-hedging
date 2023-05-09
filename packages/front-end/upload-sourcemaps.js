const SentryCli = require("@sentry/cli");
const fs = require("fs");

require("dotenv").config();

const upload = async () => {
  const cli = new SentryCli();
  const release = process.env.REACT_APP_VERCEL_GIT_COMMIT_SHA;

  const jsFiles = fs.readdirSync("./build/static/js");
  console.log(jsFiles.length);
  console.log(jsFiles);

  if (release) {
    try {
      console.log(`Creating release: ${release}...`);
      await cli.releases.new(release);

      console.log("Uploading...");
      await cli.releases.uploadSourceMaps(release, {
        include: ["build/static/js"],
        urlPrefix: "~/static/js",
        rewrite: false,
      });

      console.log("Finishing up...");
      await cli.releases.finalize(release);
    } catch (error) {
      console.error("Upload failed:", error);
    }
  } else {
    console.log(
      "No release detected. Please ensure the REACT_APP_VERCEL_GIT_COMMIT_SHA is being exposed and retry."
    );
  }
};

upload();
