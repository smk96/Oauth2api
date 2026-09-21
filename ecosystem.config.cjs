module.exports = {
    apps: [
        {
            name: 'ms-oauth2-api',
            script: 'vps.js',
            env: {
                NODE_ENV: 'production',
                HOST: '0.0.0.0',
                PORT: process.env.PORT || 3000
            }
        }
    ]
};
