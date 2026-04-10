#!/usr/bin/env deno
/// <reference types="npm:@types/node" />
// deno-lint-ignore-file no-import-prefix

import { execSync } from 'node:child_process';
import { Octokit } from 'npm:octokit@5.0.5';

const {
  GITHUB_API_URL = 'https://api.github.com',
  GITHUB_REPOSITORY = 'AprilSylph/XKit-Rewritten',
  GITHUB_TOKEN,
} = Deno.env as unknown as Record<string, string>;

const [owner, repo] = GITHUB_REPOSITORY.split('/');

try {
  const octokit = new Octokit({ auth: GITHUB_TOKEN, baseUrl: GITHUB_API_URL });

  const latestTag = execSync('git describe --tags --abbrev=0', { encoding: 'utf8' }).trim();
  const refs = new Set(execSync(`git log ${latestTag}..HEAD --reverse --pretty --format="%H" --follow src/`, { encoding: 'utf8' }).trim().split('\n'));

  const commits = new Map(
    await octokit.rest.repos
      .listCommits({ owner, repo, per_page: 100 })
      .then(({ data }) => data.map(commit => [commit.sha, commit])),
  );

  if (!refs.isSubsetOf(commits)) {
    console.log('> [!WARNING]');
    console.log('> The GitHub REST API did not return info for these commits:');
    refs.difference(commits).forEach(ref => console.log(`> - \`${ref}\``));
  }

  console.log('```md');
  for (const ref of refs.intersection(commits)) {
    const { author, commit } = commits.get(ref)!;

    console.log(`- ${
      ref
    } ${
      author?.type === 'User'
        ? `@${author?.login}`
        : `**[${author?.login}](${author?.html_url})**`
    } ${
      commit.message.includes('\n')
        ? commit.message.slice(0, commit.message.indexOf('\n'))
        : commit.message
    }`);
  }
  console.log('```');
} catch (exception) {
  console.error(exception);
}
