const cron = require('node-cron');
const { sync_DynamicsTickets_toDB_auto } = require('./tickets.controllers');

const runSync = async () => {
    console.log(`[CRON] Starting Dynamics sync at ${new Date().toISOString()}`);

    const req = {};
    const res = {
        status: (code) => ({
            json: (data) => {
                console.log(`[CRON] Sync done — status ${code}:`, data.message ?? data.error);
            },
        }),
    };

    try {
        // await sync_DynamicsTickets_toDB_auto(req, res);
    } catch (err) {
        console.error('[CRON] Sync failed:', err.message);
    }
};

// Cron format
// * * * * *
// │ │ │ │ │
// │ │ │ │ └── day of week (0-7)
// │ │ │ └──── month (1-12)
// │ │ └────── day of month (1-31)
// │ └──────── hour (0-23)
// └────────── minute (0-59)

cron.schedule('*/5 * * * *', runSync, {
    scheduled: true,
    timezone:  'UTC',
});

console.log('[CRON] Dynamics sync scheduler started — runs every 5 minutes.');

// runSync();