/**
 * Custom changelog generator based on @changesets/changelog-github
 * Removes "Thanks @username!" messages while keeping GitHub links
 */
import { getInfo, getInfoFromPullRequest } from '@changesets/get-github-info';

/**
 * Fetches changelog data from GitHub without adding thanks messages
 */
const getReleaseLine = async (changeset, type, options) => {
  if (!options || !options.repo) {
    throw new Error(
      'Please provide a repo to this changelog generator like this:\n"changelog": ["./changelog-config.js", { "repo": "org/repo" }]',
    );
  }

  let prFromSummary;
  let commitFromSummary;
  const usersFromSummary = [];

  const replacedChangelog = changeset.summary
    .replace(/^\s*(?:pr|pull|pull\s+request):\s*#?(\d+)/im, (_, pr) => {
      const num = Number(pr);
      if (!isNaN(num)) prFromSummary = num;
      return '';
    })
    .replace(/^\s*commit:\s*([^\s]+)/im, (_, commit) => {
      commitFromSummary = commit;
      return '';
    })
    .replace(/^\s*(?:author|user):\s*@?([^\s]+)/gim, (_, user) => {
      usersFromSummary.push(user);
      return '';
    })
    .trim();

  const [firstLine, ...futureLines] = replacedChangelog.split('\n').map((l) => l.trimEnd());

  const links = await (async () => {
    if (prFromSummary !== undefined) {
      let { links } = await getInfoFromPullRequest({
        repo: options.repo,
        pull: prFromSummary,
      });
      return links;
    }
    const commitToFetchFrom = commitFromSummary || changeset.commit;
    if (commitToFetchFrom) {
      let { links } = await getInfo({
        repo: options.repo,
        commit: commitToFetchFrom,
      });
      return links;
    }
    return {
      commit: null,
      pull: null,
      user: null,
    };
  })();

  const prefix = [
    links.pull === null ? '' : ` ${links.pull}`,
    links.commit === null ? '' : ` ${links.commit}`,
  ].join('');

  // Note: Removed the "Thanks @username!" suffix
  return `\n\n-${prefix ? `${prefix} -` : ''} ${firstLine}\n${futureLines.map((l) => `  ${l}`).join('\n')}`;
};

/**
 * Generates dependency update lines
 */
const getDependencyReleaseLine = async (changesets, dependenciesUpdated, options) => {
  if (!options || !options.repo) {
    throw new Error(
      'Please provide a repo to this changelog generator like this:\n"changelog": ["./changelog-config.js", { "repo": "org/repo" }]',
    );
  }
  if (dependenciesUpdated.length === 0) return '';

  const changesetLink = `- Updated dependencies [${changesets
    .map((cs) => cs.commit)
    .filter(Boolean)
    .map((commit) => `[\`${commit}\`](https://github.com/${options.repo}/commit/${commit})`)
    .join(', ')}]:`;

  const updatedDepenenciesList = dependenciesUpdated.map(
    (dependency) => `  - ${dependency.name}@${dependency.newVersion}`,
  );

  return [changesetLink, ...updatedDepenenciesList].join('\n');
};

export default {
  getReleaseLine,
  getDependencyReleaseLine,
};
