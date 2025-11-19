
/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    JULES_API_KEY: process.env.JULES_API_KEY,
    GITHUB_TOKEN: process.env.GITHUB_TOKEN,
  },
};

module.exports = nextConfig;
