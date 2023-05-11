const SentryCli = require("@sentry/cli");
const fs = require("node:fs/promises");
const glob = require("glob");

require("dotenv").config();

const upload = async () => {
  const cli = new SentryCli();
  const release = process.env.REACT_APP_VERCEL_GIT_COMMIT_SHA;

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

      console.log("Removing map files...");
      glob("./build/**/*.js.map", (_err, files) => {
        files.forEach(fs.unlink);
      });

      console.log("Removing references to map files...");
      glob("./build/**/*.js", (_err, files) => {
        files.forEach(async (filePath) => {
          try {
            const fileContent = await fs.readFile(filePath, "utf8");
            await fs.writeFile(
              filePath,
              fileContent.replace(/\/\/# sourceMappingURL=\S+/g, "")
            );
          } catch (err) {
            console.error(err);
          }
        });
      });
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
