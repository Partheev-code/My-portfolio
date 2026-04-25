import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 800 });
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle0' });

  // Scroll down slightly to make the About Me section visible
  await page.evaluate(() => {
    window.scrollTo(0, 1500);
  });
  
  // Wait a bit for the CSS transition
  await new Promise(r => setTimeout(r, 1500));

  const githubLink = await page.$('#link-github');
  if (!githubLink) {
    console.log("Could not find #link-github");
    await browser.close();
    return;
  }
  const box = await githubLink.boundingBox();
  console.log("GitHub Link Bounding Box:", box);

  if (box) {
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    console.log(`Checking element at x: ${x}, y: ${y}`);
    
    const hitData = await page.evaluate((x, y) => {
      const el = document.elementFromPoint(x, y);
      return {
        tag: el ? el.tagName : 'null',
        id: el ? el.id : 'null',
        className: el ? el.className : 'null',
        pointerEvents: el ? window.getComputedStyle(el).pointerEvents : 'null'
      };
    }, x, y);
    
    console.log("Element from point:", hitData);

    const elementsData = await page.evaluate((x, y) => {
      const els = document.elementsFromPoint(x, y);
      return els.map(e => ({
        tag: e.tagName,
        id: e.id,
        className: e.className,
        pointerEvents: window.getComputedStyle(e).pointerEvents,
        zIndex: window.getComputedStyle(e).zIndex
      }));
    }, x, y);

    console.log("Elements stack from point:");
    console.log(JSON.stringify(elementsData, null, 2));
  }

  await browser.close();
})();
