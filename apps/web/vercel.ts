import type { VercelConfig } from "@vercel/config/v1";

export const config: VercelConfig = {
  framework: "nextjs",
  crons: [
    /*
     * The monitor pass. 16:00 UTC = 19:00 Istanbul — evening on purpose: a
     * page that lands at 9am competes with the workday, while one at 7pm
     * still leaves time to do the minimum and get the day back up.
     */
    { path: "/api/monitor/check", schedule: "0 16 * * *" },
  ],
};

export default config;
