const MY_NAME = process.env["MY_NAME"] || "N/A";
console.log(`Hello, ${MY_NAME}`);

// import * as core from "@actions/core";
// import * as github from "@actions/github";
// import { Octokit } from "@octokit/rest";
// (async () => {
//   try {
//     const time = (new Date()).toTimeString();
//     core.setOutput("time", time);
//     //github.getOctokit(process.env["GITHUB_TOKEN"] as string).rest.repos.createRelease
//     const octokit = new Octokit();
//     await octokit.repos.createRelease({
//       owner: "",
//       repo: "",
//       tag_name: "",
//       generate_release_notes: true,
//       draft: true,
//       prerelease: true
//     });
//   } catch (error) {
//   }
// })();
