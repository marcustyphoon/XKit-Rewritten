import { apiFetch } from './tumblr_helpers.js';

export let fetchedUserInfo;
export let fetchedCommunitiesInfo;

export const init = async () => {
  [
    fetchedUserInfo,
    fetchedCommunitiesInfo
  ] = await Promise.all([
    apiFetch('/v2/user/info').catch((error) => {
      console.error(error);
      return { response: {} };
    }),
    apiFetch('/v2/communities').catch((error) => {
      console.error(error);
      return { response: [] };
    })
  ]);
  console.log({ fetchedUserInfo, fetchedCommunitiesInfo });
};
