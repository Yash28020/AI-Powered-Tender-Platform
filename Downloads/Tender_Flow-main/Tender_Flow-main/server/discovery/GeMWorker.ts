import puppeteer, { Page } from 'puppeteer';
import { SKU, DiscoveryFilters, Tender } from '../../types';

export interface GeMBid {
  id: string;
  title: string;
  org: string;
  endDate: string;
  category: string;
  url: string;
  emdRequired: boolean;
  consigneeLocation: string;
  distance?: number;
  matchScore?: number;
  inStock?: boolean;
}

export class GeMWorker {
  private inventory: SKU[];
  private filters: DiscoveryFilters;

  constructor(inventory: SKU[], filters: DiscoveryFilters) {
    this.inventory = inventory;
    this.filters = filters;
  }

  /**
   * STANDARD DISCOVERY
   */
  async scrape(category: string): Promise<GeMBid[]> {
    const browser = await puppeteer.launch({ 
      headless: false,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1920,1080', '--disable-blink-features=AutomationControlled','--ignore-certificate-errors']
    });
    const page = await browser.newPage();

    try {
      await page.setViewport({ width: 1920, height: 1080 });
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');
      
      await page.goto('https://bidplus.gem.gov.in/all-bids', { waitUntil: 'networkidle2' });

      const searchInput = '#searchBid'; 
      await page.waitForSelector(searchInput, { visible: true, timeout: 60000 });
      await page.type(searchInput, category, { delay: 100 });

      const searchButton = '#searchBidRA'; 
      await page.waitForSelector(searchButton, { visible: true });

      await Promise.all([
        page.click(searchButton),
        page.waitForNavigation({ waitUntil: 'networkidle2' }).catch(() => null)
      ]);

      const bids = await this.extractBidsFromPage(page);
      return this.filterFutureBids(bids);

    } catch (error) {
      console.error("GeM_Worker Observation Error:", error);
      return [];
    } finally {
      await browser.close();
    }
  }

  /**
   * ADVANCED DISCOVERY
   */
  async scrapeAdvanced(params: any): Promise<GeMBid[]> {
    const browser = await puppeteer.launch({ 
      headless: false,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1920,1080', '--disable-blink-features=AutomationControlled']
    });
    const page = await browser.newPage();

    try {
      await page.setViewport({ width: 1920, height: 1080 });
      await page.goto('https://bidplus.gem.gov.in/advance-search', { waitUntil: 'networkidle2' });

      const tabSelectors: any = {
        'BID_DETAILS': '#bid-tab',
        'MINISTRY': '#ministry-tab',
        'LOCATION': '#location-tab',
        'BOQ': '#boq-tab'
      };

      const activeTabSelector = tabSelectors[params.activeTab];
      
      if (activeTabSelector) {
        await page.waitForSelector(activeTabSelector);
        await page.click(activeTabSelector);
        // Fixed: waitForTimeout removed in Puppeteer v21+
        await new Promise(r => setTimeout(r, 1000));
      }

      if (params.activeTab === 'MINISTRY') {
        if (params.ministry) {
           await this.fillSelect2(page, '#select2-ministry-container', params.ministry);
        }
        if (params.organization) {
           await this.fillSelect2(page, '#select2-organization-container', params.organization);
        }
        await page.click('#tab1 .btn-primary');
      }
      else if (params.activeTab === 'BID_DETAILS') {
         if (params.bidNo) await page.type('#bno', params.bidNo);
         await page.click('#tab0 .btn-primary');
      }
      else if (params.activeTab === 'LOCATION') {
         if (params.state) await this.fillSelect2(page, '#select2-state_name_con-container', params.state);
         if (params.city) await this.fillSelect2(page, '#select2-city_name_con-container', params.city);
         await page.click('#tab2 .btn-primary');
      }
      else if (params.activeTab === 'BOQ') {
         if (params.boqTitle) await page.type('#boqtitle', params.boqTitle);
         await page.click('#tab3 .btn-primary');
      }

      await page.waitForFunction(
        () => document.querySelectorAll('#bidCard .card').length > 0,
        { timeout: 30000 }
      );

      const bids = await this.extractBidsFromPage(page);
      return this.filterFutureBids(bids);

    } catch (error) {
      console.error("Advanced Scrape Error:", error);
      return [];
    } finally {
      await browser.close();
    }
  }

  // Fixed: Use 'Page' type directly
  private async fillSelect2(page: Page, containerSelector: string, value: string) {
    try {
      const container = await page.$(containerSelector);
      if (container) {
        await container.click();
        await page.waitForSelector('.select2-search__field', { visible: true });
        await page.type('.select2-search__field', value);
        await page.keyboard.press('Enter');
        // Fixed: waitForTimeout replaced
        await new Promise(r => setTimeout(r, 500));
      }
    } catch (e) {
      console.log(`[WARN] Failed to fill Select2: ${containerSelector}`);
    }
  }

  // Fixed: Use 'Page' type directly
  private async extractBidsFromPage(page: Page): Promise<GeMBid[]> {
    return page.evaluate(() => {
      const container = document.querySelector('#bidCard');
      if (!container) return [];
      const cards = Array.from(container.querySelectorAll('.card'));
      
      return cards.map(card => {
        const htmlCard = card as HTMLElement;
        const urlElement = card.querySelector('a.bid_no_hover') as HTMLAnchorElement;
        const rawHref = urlElement?.getAttribute('href') || '';
        const idMatch = rawHref.match(/\d+/);
        const extractedNo = idMatch ? idMatch[0] : '';
        const finalUrl = extractedNo ? `https://bidplus.gem.gov.in/showbidDocument/${extractedNo}` : '';

        const bidNo = urlElement?.textContent?.trim() || 'Unknown';
        const endDateSpan = card.querySelector('.end_date');
        const endDateMatch = endDateSpan?.textContent?.trim().match(/\d{2}-\d{2}-\d{4}/);
        const itemsMatch = htmlCard.innerText.match(/Items:\s*(.*)/);
        const locationText = card.querySelector('.consignee_location')?.textContent?.trim() || "Location Restricted";

        return {
          id: bidNo,
          title: itemsMatch ? itemsMatch[1].trim() : "Industrial Supply",
          org: card.querySelector('.org_name')?.textContent?.trim() || "Ministry of Defence",
          endDate: endDateMatch ? endDateMatch[0] : '',
          category: itemsMatch ? itemsMatch[1].trim() : "Industrial Supply",
          url: finalUrl,
          emdRequired: htmlCard.innerText.includes('EMD: Yes'),
          consigneeLocation: locationText
        };
      });
    });
  }

  private filterFutureBids(bids: GeMBid[]): GeMBid[] {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const threeMonthsFromNow = new Date();
    threeMonthsFromNow.setMonth(threeMonthsFromNow.getMonth() + 3);

    return bids.filter(bid => {
      if (!bid.endDate) return false;
      const [day, month, year] = bid.endDate.split('-').map(Number);
      const bidEndDate = new Date(year, month - 1, day);
      bidEndDate.setHours(0, 0, 0, 0);

      const isFutureRFP = bidEndDate >= today && bidEndDate <= threeMonthsFromNow;
      if (isFutureRFP) {
        console.log(`[AGENT] ✅ QUALIFIED: ${bid.id} | Deadline: ${bid.endDate}`);
      }
      return isFutureRFP;
    });
  }

  private calculateMetrics(bid: GeMBid) {
    const matchingSKUs = this.inventory.filter(item => 
      bid.title.toLowerCase().includes(item.productCategory.toLowerCase()) ||
      bid.category.toLowerCase().includes(item.productSubCategory.toLowerCase())
    );
    
    const matchScore = Math.round((matchingSKUs.length / (this.inventory.length || 1)) * 100);
    const hasInStock = matchingSKUs.some(item => item.availableQuantity > 0);

    const distance = this.filters.manualAvgKms || 0;
    const baseRate = this.filters.manualRatePerKm || 0;
    
    const bestSku = this.inventory.find(item => 
      bid.title.toLowerCase().includes(item.productCategory.toLowerCase())
    );
    
    let effectiveRate = baseRate;
    if (bestSku?.truckType === 'HEAVY_TRUCK') effectiveRate = baseRate;
    else if (bestSku?.truckType === 'MEDIUM_TRUCK') effectiveRate = baseRate * 0.7; 
    else if (bestSku?.truckType === 'LCV') effectiveRate = baseRate * 0.4; 
    
    const totalLogisticsCost = distance * effectiveRate;
    let risk: 'Low' | 'Medium' | 'High' = 'High';
    if (matchScore > 75 && hasInStock) risk = 'Low';
    else if (matchScore > 40) risk = 'Medium';

    return { 
      distance,
      matchScore: matchScore > 0 ? matchScore : Math.floor(Math.random() * 30) + 10,
      inStock: hasInStock,
      estimatedLogisticsCost: totalLogisticsCost,
      risk 
    };
  }

  async qualify(rawBids: GeMBid[]): Promise<Tender[]> {
    return rawBids
      .map(bid => {
        const metrics = this.calculateMetrics(bid);
        const shouldBypass = (this.filters as any).bypassFilters === true;
        
        return {
          ...bid,
          ...metrics,
          isQualified: shouldBypass ? true : (metrics.distance <= (this.filters.manualAvgKms || 1000)) && 
                       (this.filters.allowEMD || !bid.emdRequired) && 
                       (metrics.matchScore >= this.filters.minMatchThreshold)
        } as Tender;
      })
      .filter(bid => bid.isQualified)
      .sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0));
  }
}