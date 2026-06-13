import { chromium } from "playwright";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (msg) => {
  if (msg.type() === "error") errors.push(msg.text());
});

await page.goto("http://localhost:8080/special/event/event_detail.html?id=ev000001", {
  waitUntil: "networkidle"
});
await page.waitForTimeout(1500);

const gnb = await page.evaluate(() => {
  const mount = document.querySelector("[data-ti-left-gnb]");
  const logo = document.querySelector(".ti-snb-logo img");
  return {
    mountHtml: mount ? mount.innerHTML.slice(0, 200) : null,
    mountLen: mount ? mount.innerHTML.length : 0,
    hasGnb: !!document.querySelector(".ti-gnb"),
    hasSchedule: !!document.getElementById("tiDayTabs"),
    logoSrc: logo ? logo.getAttribute("src") : null,
    leftDisplay: mount ? getComputedStyle(mount).display : null,
    leftVisible: mount ? mount.offsetHeight > 0 : false
  };
});

console.log(JSON.stringify({ gnb, errors }, null, 2));
await browser.close();
