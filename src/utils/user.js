import { apiFetch } from './tumblr_helpers.js';

performance.mark('xkit user');

const [
  fetchedUserInfo,
  fetchedCommunitiesInfo,
] = await Promise.all([
  apiFetch('/v2/user/info?fields%5Bblogs%5D=%3Favatar%2Cname%2C%3Ftitle%2Curl%2C%3Fblog_view_url%2C%3Fcan_message%2C%3Fdescription%2C%3Fis_adult%2C%3Fuuid%2C%3Fis_private_channel%2C%3Fposts%2C%3Fis_group_channel%2C%3Fprimary%2C%3Fadmin%2C%3Fdrafts%2C%3Ffollowers%2C%3Fqueue%2C%3Fhas_flagged_posts%2C%3Fmessages%2C%3Fask%2C%3Fcan_submit%2C%3Fmention_key%2C%3Ftimezone_offset%2C%3Fanalytics_url%2C%3Fis_premium_partner%2C%3Fis_blogless_advertiser%2C%3Fis_tumblrpay_onboarded%2C%3Ftheme%2C%3Ftumblrmart_orders', { cache: 'force-cache' }).catch((error) => {
    console.error(error);
    return { response: {} };
  }),
  apiFetch('/v2/communities?mine=1', { cache: 'force-cache' }).catch((error) => {
    console.error(error);
    return { response: [] };
  }),
]);

performance.measure('xkit user');

/**
 * {object?} userInfo - The contents of the /v2/user/info API endpoint
 */
export const userInfo = fetchedUserInfo.response.user;

/**
 * {object[]} userBlogs - An array of blog objects the current user has post access to
 */
export const userBlogs = userInfo?.blogs ?? [];

/**
 * {string[]} userBlogNames - An array of blog names the current user has post access to
 */
export const userBlogNames = userBlogs.map(blog => blog.name);

/**
 * {object?} primaryBlog - The primary ("main") blog for the user
 */
export const primaryBlog = userBlogs.find(blog => blog.primary === true);

/**
 * {string?} primaryBlogName - The name of the user's primary blog
 */
export const primaryBlogName = primaryBlog?.name;

/**
 * {object[]} adminBlogs - An array of blog objects the current user is admin of
 */
export const adminBlogs = userInfo?.blogs?.filter(blog => blog.admin) ?? [];

/**
 * {string[]} adminBlogNames - An array of blog names the current user is admin of
 */
export const adminBlogNames = adminBlogs.map(blog => blog.name);

let communitiesOrder = [];
try {
  communitiesOrder = JSON.parse(localStorage.getItem('sortableCommunitiesOrder')) ?? [];
} catch {}

const getOrder = community => {
  const index = communitiesOrder.indexOf(community.name);
  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
};

/**
 * {object?} joinedCommunities - An array of community objects the current user has joined
 */
export const joinedCommunities = fetchedCommunitiesInfo.response.toSorted((a, b) => getOrder(a) - getOrder(b));

/**
 * {string[]} joinedCommunityUuids - An array of community uuids the current user has joined
 */
export const joinedCommunityUuids = joinedCommunities.map(community => community.uuid);
