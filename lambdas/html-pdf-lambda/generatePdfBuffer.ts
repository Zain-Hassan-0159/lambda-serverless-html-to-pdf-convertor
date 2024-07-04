import chromium from '@sparticuz/chromium'
import puppeteer from 'puppeteer-core'

export const generatePdfBuffer = async (
  html: string,
): Promise<Buffer | undefined> => {
  let result = undefined
  let browser = null
  try {
    console.log('Launching browser')
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: false,
    })
    
    console.log('Browser launched')
    const page = await browser.newPage()

    await page.setContent(html)

    result = await page.pdf({ printBackground: true })
  } catch (e) {
    console.log('Chromium error', { e })
  } finally {
    if (browser !== null) {
      await browser.close()
    }
  }
  return result as Buffer;
}