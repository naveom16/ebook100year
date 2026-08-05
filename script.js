/* ==========================================================================
   ตำรา ๑๐๐ ปี eBooks — script.js
   Handles: book data, rendering, search, category filtering, and the
   book-detail modal. Written so new books or a real API can be dropped
   into BOOKS / fetchBooks() without touching the render logic.
   ========================================================================== */

(function () {
  'use strict';

  /* ------------------------------------------------------------------------
     1. Category list — order defines both the filter pills and the
        cover-art pattern (cover-cat-0 ... cover-cat-9) used per category.
     ------------------------------------------------------------------------ */
  const CATEGORIES = [
    'การศึกษาและจิตวิทยา',
    'ศิลปะและวัฒนธรรม',
    'ภาษา วรรณกรรม และการสื่อสาร',
    'สังคม การเมือง และกฎหมาย',
    'ศาสนาและปรัชญา',
    'ธุรกิจ การจัดการ และการท่องเที่ยว',
    'ประวัติศาสตร์ ภูมิศาสตร์ และโบราณคดี',
    'วิศวกรรม คอมพิวเตอร์ และเทคโนโลยี',
    'วิทยาศาสตร์กายภาพและชีวภาพ',
    'วิทยาศาสตร์ สุขภาพ และสิ่งแวดล้อม'
  ];

  /* ------------------------------------------------------------------------
     1b. Google Sheet data source
        ------------------------------------------------------------------
        Books are loaded live from a Google Sheet via the Sheets API v4
        (read-only, using an API key — no OAuth needed since the sheet is
        shared as "Anyone with the link can view").

        Required sheet columns (any order, header row required):
        title | author | faculty | year | page | description | category |
        tags | cover_url | pdf_url | fulltext_url

        NOTE ON THE API KEY: this key is visible to anyone who views the
        page source, which is normal for browser-side Google API calls —
        just make sure it's restricted in Google Cloud Console to
        (a) the Sheets API only, and (b) your site's domain as an HTTP
        referrer, so it can't be reused elsewhere.
     ------------------------------------------------------------------------ */
  const SHEET_CONFIG = {
    apiKey: 'AIzaSyBZnuU0hL6RKNzRWXW7nozBwofvmrZqYyc',
    spreadsheetId: '1hfqwP3KlakzE8HDovKVRzRy0y2j2on79QbkfwNfAD18',
    sheetName: 'Sheet1',   // <-- change to match your tab name if different
    range: 'A:K'
  };

  /* ------------------------------------------------------------------------
     2. Fallback book data
        ------------------------------------------------------------------
        Shown only if the Google Sheet can't be reached (offline, wrong
        sharing permission, API not enabled, etc.) so the page still works
        for a demo. Once the sheet loads successfully this is unused.
     ------------------------------------------------------------------------ */
  const FALLBACK_BOOKS = [
    {
      id: 1,
      title: "จิตวิญญาณความเป็นครู: Teachers' Spirituality",
      author: "จตุรงค์ ธนะสีลังกูร",
      year: "2567",
      pages: "242",
      category: "การศึกษาและจิตวิทยา",
      image: "",
      ebookLink: "#",
      fulltextLink: "#",
      description: [
        "หนังสือเล่มนี้ว่าด้วยมิติทางจิตวิญญาณของวิชาชีพครู สำรวจแรงบันดาลใจและคุณค่าภายในที่หล่อหลอมความเป็นครูให้ลึกซึ้งกว่าการถ่ายทอดความรู้ในตำรา",
        "ผู้เขียนถ่ายทอดผ่านกรณีศึกษาและประสบการณ์ตรงในห้องเรียน ชวนผู้อ่านทบทวนบทบาทของครูในฐานะผู้บ่มเพาะทั้งปัญญาและจิตใจของผู้เรียน"
      ]
    },
    {
      id: 2,
      title: "ศิลปะพื้นถิ่นอีสาน: จากแผ่นดินสู่งานช่าง",
      author: "ปิยะดา วงศ์สุริยา",
      year: "2566",
      pages: "198",
      category: "ศิลปะและวัฒนธรรม",
      image: "",
      ebookLink: "#",
      fulltextLink: "#",
      description: [
        "รวบรวมและวิเคราะห์งานศิลปะพื้นถิ่นในภาคอีสาน ตั้งแต่งานทอผ้า จักสาน ไปจนถึงสถาปัตยกรรมพื้นบ้าน สะท้อนภูมิปัญญาที่สืบทอดจากรุ่นสู่รุ่น",
        "เนื้อหาอ้างอิงจากการลงพื้นที่เก็บข้อมูลในหลายชุมชนของจังหวัดนครราชสีมาและใกล้เคียง พร้อมภาพประกอบและบทสัมภาษณ์ช่างฝีมือ"
      ]
    },
    {
      id: 3,
      title: "วรรณกรรมไทยร่วมสมัย: เสียงจากยุคเปลี่ยนผ่าน",
      author: "สุนิสา แก้วมณี",
      year: "2565",
      pages: "276",
      category: "ภาษา วรรณกรรม และการสื่อสาร",
      image: "",
      ebookLink: "#",
      fulltextLink: "#",
      description: [
        "วิเคราะห์แนวโน้มของวรรณกรรมไทยในช่วงสามทศวรรษหลัง ผ่านตัวบทคัดสรรที่สะท้อนความเปลี่ยนแปลงทางสังคม เศรษฐกิจ และเทคโนโลยีการสื่อสาร",
        "เหมาะสำหรับนักศึกษาวรรณคดีและผู้สนใจศึกษาความสัมพันธ์ระหว่างวรรณกรรมกับบริบททางประวัติศาสตร์ร่วมสมัย"
      ]
    },
    {
      id: 4,
      title: "การเมืองไทยในกระแสโลกาภิวัตน์",
      author: "ธีรพล ศรีสุวรรณ",
      year: "2564",
      pages: "312",
      category: "สังคม การเมือง และกฎหมาย",
      image: "",
      ebookLink: "#",
      fulltextLink: "#",
      description: [
        "ศึกษาพลวัตการเมืองไทยภายใต้แรงกดดันจากกระแสโลกาภิวัตน์ ทั้งด้านเศรษฐกิจ การทูต และการเคลื่อนไหวทางสังคมข้ามพรมแดน",
        "หนังสือเล่มนี้ใช้กรอบทฤษฎีรัฐศาสตร์เปรียบเทียบ ประกอบกับกรณีศึกษาการเมืองไทยตั้งแต่ทศวรรษ 2540 จนถึงปัจจุบัน"
      ]
    },
    {
      id: 5,
      title: "พุทธปรัชญากับชีวิตสมัยใหม่",
      author: "พระมหาวิรัตน์ ปัญญาวุฑโฒ",
      year: "2563",
      pages: "224",
      category: "ศาสนาและปรัชญา",
      image: "",
      ebookLink: "#",
      fulltextLink: "#",
      description: [
        "นำหลักพุทธปรัชญามาตีความใหม่ในบริบทของชีวิตสมัยใหม่ที่เต็มไปด้วยความเร่งรีบและความไม่แน่นอน",
        "เนื้อหาแบ่งเป็นหมวดง่ายต่อการนำไปประยุกต์ใช้ในชีวิตประจำวัน ทั้งด้านการทำงาน ความสัมพันธ์ และการจัดการความเครียด"
      ]
    },
    {
      id: 6,
      title: "การจัดการการท่องเที่ยวเชิงวัฒนธรรมโคราช",
      author: "อรุณี พงษ์ศิริ",
      year: "2567",
      pages: "256",
      category: "ธุรกิจ การจัดการ และการท่องเที่ยว",
      image: "",
      ebookLink: "#",
      fulltextLink: "#",
      description: [
        "นำเสนอแนวทางการจัดการการท่องเที่ยวเชิงวัฒนธรรมในพื้นที่จังหวัดนครราชสีมา โดยเน้นการมีส่วนร่วมของชุมชนและความยั่งยืน",
        "มีกรณีศึกษาจากแหล่งท่องเที่ยวจริงในพื้นที่ พร้อมข้อเสนอแนะเชิงนโยบายสำหรับหน่วยงานท้องถิ่นและผู้ประกอบการ"
      ]
    },
    {
      id: 7,
      title: "ปราสาทหินและอารยธรรมขอมในอีสานใต้",
      author: "ประเสริฐ บุญเรือง",
      year: "2562",
      pages: "340",
      category: "ประวัติศาสตร์ ภูมิศาสตร์ และโบราณคดี",
      image: "",
      ebookLink: "#",
      fulltextLink: "#",
      description: [
        "สำรวจประวัติศาสตร์และสถาปัตยกรรมของกลุ่มปราสาทหินในเขตอีสานใต้ ร่องรอยแห่งอารยธรรมขอมโบราณที่ยังหลงเหลืออยู่จนถึงปัจจุบัน",
        "อ้างอิงหลักฐานทางโบราณคดีและจารึก พร้อมแผนที่และภาพถ่ายประกอบจากการสำรวจภาคสนามหลายพื้นที่"
      ]
    },
    {
      id: 8,
      title: "ปัญญาประดิษฐ์เพื่องานวิศวกรรมยุคใหม่",
      author: "ณัฐพล เจริญวงศ์",
      year: "2568",
      pages: "288",
      category: "วิศวกรรม คอมพิวเตอร์ และเทคโนโลยี",
      image: "",
      ebookLink: "#",
      fulltextLink: "#",
      description: [
        "แนะนำแนวคิดพื้นฐานและการประยุกต์ใช้ปัญญาประดิษฐ์ในงานวิศวกรรม ตั้งแต่การบำรุงรักษาเชิงพยากรณ์ไปจนถึงระบบควบคุมอัตโนมัติ",
        "เขียนขึ้นสำหรับนักศึกษาวิศวกรรมและวิศวกรในภาคอุตสาหกรรมที่ต้องการปรับตัวเข้าสู่ยุคอุตสาหกรรม 4.0"
      ]
    },
    {
      id: 9,
      title: "ชีววิทยาแมลงในระบบนิเวศเกษตร",
      author: "วราภรณ์ ทองดี",
      year: "2566",
      pages: "204",
      category: "วิทยาศาสตร์กายภาพและชีวภาพ",
      image: "",
      ebookLink: "#",
      fulltextLink: "#",
      description: [
        "ศึกษาบทบาทของแมลงในระบบนิเวศเกษตร ทั้งแมลงศัตรูพืชและแมลงที่เป็นประโยชน์ พร้อมแนวทางการจัดการศัตรูพืชแบบผสมผสาน",
        "เหมาะสำหรับนักศึกษาเกษตรศาสตร์และเกษตรกรที่สนใจแนวทางการเพาะปลูกที่เป็นมิตรต่อสิ่งแวดล้อม"
      ]
    },
    {
      id: 10,
      title: "สิ่งแวดล้อมและสุขภาพชุมชนในเขตเมือง",
      author: "กมลชนก ไชยวงศ์",
      year: "2567",
      pages: "230",
      category: "วิทยาศาสตร์ สุขภาพ และสิ่งแวดล้อม",
      image: "",
      ebookLink: "#",
      fulltextLink: "#",
      description: [
        "วิเคราะห์ความเชื่อมโยงระหว่างคุณภาพสิ่งแวดล้อมในเขตเมืองกับสุขภาพของประชาชน โดยใช้กรณีศึกษาจากพื้นที่เมืองขนาดกลางในภาคอีสาน",
        "นำเสนอข้อมูลเชิงสถิติควบคู่กับข้อเสนอแนะเชิงนโยบายด้านสาธารณสุขและการวางผังเมือง"
      ]
    },
    {
      id: 11,
      title: "จิตวิทยาการเรียนรู้สำหรับเด็กปฐมวัย",
      author: "รัตนา ศรีวิไล",
      year: "2565",
      pages: "216",
      category: "การศึกษาและจิตวิทยา",
      image: "",
      ebookLink: "#",
      fulltextLink: "#",
      description: [
        "รวมหลักการและทฤษฎีจิตวิทยาพัฒนาการที่เกี่ยวข้องกับการเรียนรู้ของเด็กปฐมวัย พร้อมแนวทางออกแบบกิจกรรมที่เหมาะสมกับแต่ละช่วงวัย",
        "เขียนขึ้นเพื่อเป็นแนวทางสำหรับครูปฐมวัยและผู้ปกครองในการส่งเสริมพัฒนาการเด็กอย่างรอบด้าน"
      ]
    },
    {
      id: 12,
      title: "ภูมิสถาปัตยกรรมเมืองโคราช: พื้นที่สีเขียวในเมือง",
      author: "ชัยวัฒน์ ดำรงกิจ",
      year: "2568",
      pages: "192",
      category: "ประวัติศาสตร์ ภูมิศาสตร์ และโบราณคดี",
      image: "",
      ebookLink: "#",
      fulltextLink: "#",
      description: [
        "ศึกษาวิวัฒนาการของพื้นที่สีเขียวและภูมิสถาปัตยกรรมเมืองนครราชสีมา ตั้งแต่ยุคเริ่มก่อตั้งเมืองจนถึงการวางผังเมืองสมัยใหม่",
        "เสนอแนวทางการออกแบบพื้นที่สาธารณะที่สมดุลระหว่างการอนุรักษ์และการพัฒนาเมืองอย่างยั่งยืน"
      ]
    },
    {
      id: 13,
      title: "หลักการแปลภาษาไทย-อังกฤษเพื่องานวิชาการ",
      author: "นภาพร เลิศสุวรรณ",
      year: "2564",
      pages: "188",
      category: "ภาษา วรรณกรรม และการสื่อสาร",
      image: "",
      ebookLink: "#",
      fulltextLink: "#",
      description: [
        "คู่มือหลักการแปลบทความวิชาการระหว่างภาษาไทยและภาษาอังกฤษ ครอบคลุมเทคนิคการรักษาความหมายและน้ำเสียงของต้นฉบับ",
        "มีแบบฝึกหัดและตัวอย่างบทแปลจากหลากหลายสาขาวิชา เหมาะสำหรับนักศึกษาและนักแปลมือใหม่"
      ]
    },
    {
      id: 14,
      title: "กฎหมายปกครองท้องถิ่นไทย",
      author: "สมเกียรติ วัฒนไพศาล",
      year: "2563",
      pages: "264",
      category: "สังคม การเมือง และกฎหมาย",
      image: "",
      ebookLink: "#",
      fulltextLink: "#",
      description: [
        "อธิบายโครงสร้างและหลักกฎหมายที่เกี่ยวข้องกับการปกครองส่วนท้องถิ่นของไทย ตั้งแต่เทศบาลไปจนถึงองค์การบริหารส่วนจังหวัด",
        "เหมาะสำหรับนักศึกษานิติศาสตร์และรัฐประศาสนศาสตร์ รวมถึงบุคลากรองค์กรปกครองส่วนท้องถิ่น"
      ]
    },
    {
      id: 15,
      title: "เทคโนโลยีพลังงานทดแทนเพื่อชุมชน",
      author: "ศิริพงษ์ แสงทอง",
      year: "2568",
      pages: "212",
      category: "วิศวกรรม คอมพิวเตอร์ และเทคโนโลยี",
      image: "",
      ebookLink: "#",
      fulltextLink: "#",
      description: [
        "นำเสนอเทคโนโลยีพลังงานทดแทนที่เหมาะสมกับบริบทชุมชนชนบท ทั้งพลังงานแสงอาทิตย์ ชีวมวล และพลังงานลมขนาดเล็ก",
        "มีกรณีศึกษาการติดตั้งจริงในหมู่บ้านนำร่องหลายแห่งในภาคอีสาน พร้อมการวิเคราะห์ความคุ้มค่าทางเศรษฐศาสตร์"
      ]
    },
    {
      id: 16,
      title: "ปรัชญาตะวันตกเบื้องต้น",
      author: "วิภาวี ชูเกียรติ",
      year: "2562",
      pages: "296",
      category: "ศาสนาและปรัชญา",
      image: "",
      ebookLink: "#",
      fulltextLink: "#",
      description: [
        "ปูพื้นฐานความคิดของนักปรัชญาตะวันตกคนสำคัญ ตั้งแต่ยุคกรีกโบราณจนถึงปรัชญาสมัยใหม่ ในภาษาที่เข้าใจง่าย",
        "เหมาะสำหรับผู้เริ่มต้นศึกษาปรัชญา ใช้เป็นตำราประกอบรายวิชาปรัชญาเบื้องต้นในระดับปริญญาตรี"
      ]
    }
  ];

  /* ------------------------------------------------------------------------
     4. State
     ------------------------------------------------------------------------ */
  const ITEMS_PER_PAGE = 12;

  let BOOKS = [];                        // populated by loadBooks() from the sheet
  let FILTER_CATEGORIES = ['ทั้งหมด'];   // rebuilt from whatever categories exist in BOOKS
  let activeCategory = 'ทั้งหมด';
  let searchTerm = '';
  let currentPage = 1;
  let lastFocusedElement = null;

  /* ------------------------------------------------------------------------
     4. DOM references
     ------------------------------------------------------------------------ */
  const bookGrid = document.getElementById('bookGrid');
  const filterRow = document.getElementById('filterRow');
  const searchInput = document.getElementById('searchInput');
  const clearSearchBtn = document.getElementById('clearSearch');
  const resultsMeta = document.getElementById('resultsMeta');
  const emptyState = document.getElementById('emptyState');

  const connectionNotice = document.getElementById('connectionNotice');
  const connectionNoticeText = document.getElementById('connectionNoticeText');
  const retryConnectionBtn = document.getElementById('retryConnection');

  const pagination = document.getElementById('pagination');
  const prevPageBtn = document.getElementById('prevPage');
  const nextPageBtn = document.getElementById('nextPage');
  const pageIndicator = document.getElementById('pageIndicator');

  const modal = document.getElementById('bookModal');
  const modalClose = document.getElementById('modalClose');
  const modalCover = document.getElementById('modalCover');
  const modalCategory = document.getElementById('modalCategory');
  const modalTitle = document.getElementById('modalTitle');
  const modalAuthor = document.getElementById('modalAuthor');
  const modalAuthorName = document.getElementById('modalAuthorName');
  const modalYear = document.getElementById('modalYear');
  const modalPages = document.getElementById('modalPages');
  const modalCategoryText = document.getElementById('modalCategoryText');
  const modalDescription = document.getElementById('modalDescription');
  const modalEbookLink = document.getElementById('modalEbookLink');
  const modalFulltextLink = document.getElementById('modalFulltextLink');
  const modalFacultyRow = document.getElementById('modalFacultyRow');
  const modalFaculty = document.getElementById('modalFaculty');
  const modalTags = document.getElementById('modalTags');

  /* ------------------------------------------------------------------------
     5. Helpers
     ------------------------------------------------------------------------ */
  function categoryIndex(category) {
    const i = CATEGORIES.indexOf(category);
    return i === -1 ? 0 : i % 10;
  }

  // Pull a short, display-friendly fragment of the title for the
  // generated placeholder cover (used only when no real image is set).
  function coverGlyph(title) {
    return title.length > 40 ? title.slice(0, 40) + '…' : title;
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  /* ------------------------------------------------------------------------
     5b. Google Sheet loading
     ------------------------------------------------------------------------ */

  // Fetches the sheet values, with one automatic retry against the first
  // available tab if SHEET_CONFIG.sheetName doesn't match (the most common
  // setup mistake — a 400 "Unable to parse range" error).
  async function fetchSheetValues() {
    const base = 'https://sheets.googleapis.com/v4/spreadsheets/' + SHEET_CONFIG.spreadsheetId;
    const rangeFor = function (tabName) { return encodeURIComponent(tabName + '!' + SHEET_CONFIG.range); };

    let res = await fetch(base + '/values/' + rangeFor(SHEET_CONFIG.sheetName) + '?key=' + SHEET_CONFIG.apiKey);

    if (res.status === 400) {
      const metaRes = await fetch(base + '?key=' + SHEET_CONFIG.apiKey + '&fields=sheets.properties.title');
      if (metaRes.ok) {
        const meta = await metaRes.json();
        const firstTab = meta.sheets && meta.sheets[0] && meta.sheets[0].properties && meta.sheets[0].properties.title;
        if (firstTab && firstTab !== SHEET_CONFIG.sheetName) {
          res = await fetch(base + '/values/' + rangeFor(firstTab) + '?key=' + SHEET_CONFIG.apiKey);
        }
      }
    }

    if (!res.ok) {
      const body = await res.json().catch(function () { return {}; });
      throw new Error((body.error && body.error.message) || ('HTTP ' + res.status));
    }

    const data = await res.json();
    return data.values || [];
  }

  // Maps sheet rows (header row + data rows) into the book object shape
  // the rest of the app uses. Looks columns up by header name so column
  // order in the sheet doesn't matter.
  function rowsToBooks(rows) {
    if (!rows || rows.length < 2) return [];

    const headers = rows[0].map(function (h) { return String(h || '').trim().toLowerCase(); });
    const col = function (name) { return headers.indexOf(name); };

    const iTitle = col('title'), iAuthor = col('author'), iFaculty = col('faculty'),
      iYear = col('year'), iPage = col('page'), iDesc = col('description'),
      iCategory = col('category'), iTags = col('tags'), iCover = col('cover_url'),
      iPdf = col('pdf_url'), iFulltext = col('fulltext_url');

    return rows.slice(1)
      .filter(function (row) { return row && row.length && iTitle > -1 && String(row[iTitle] || '').trim(); })
      .map(function (row, i) {
        const cell = function (idx) { return idx > -1 && row[idx] != null ? String(row[idx]).trim() : ''; };
        const descRaw = cell(iDesc);
        const tagsRaw = cell(iTags);

        return {
          id: i + 1,
          title: cell(iTitle),
          author: cell(iAuthor),
          faculty: cell(iFaculty),
          year: cell(iYear).replace(/,/g, ''),
          pages: cell(iPage).replace(/,/g, ''),
          category: cell(iCategory) || 'ทั่วไป',
          tags: tagsRaw ? tagsRaw.split(',').map(function (t) { return t.trim(); }).filter(Boolean) : [],
          image: cell(iCover),
          ebookLink: cell(iPdf) || '#',
          fulltextLink: cell(iFulltext) || '#',
          description: descRaw ? descRaw.split(/\n+/).filter(Boolean) : ['ไม่มีคำอธิบายเพิ่มเติมสำหรับหนังสือเล่มนี้']
        };
      });
  }

  // Filter pills follow the university's canonical 10-category order first,
  // then append any category found in the sheet that isn't on that list —
  // so a typo or a new category in the sheet still shows up rather than
  // silently vanishing.
  function buildFilterCategories(books) {
    const present = [];
    books.forEach(function (b) {
      if (b.category && present.indexOf(b.category) === -1) present.push(b.category);
    });
    const known = CATEGORIES.filter(function (c) { return present.indexOf(c) > -1; });
    const extra = present.filter(function (c) { return CATEGORIES.indexOf(c) === -1; }).sort();
    return ['ทั้งหมด'].concat(known, extra);
  }

  function skeletonMarkup(count) {
    let html = '';
    for (let i = 0; i < count; i++) {
      html +=
        '<div class="book-card skeleton-card" aria-hidden="true">' +
          '<div class="book-cover skeleton-shimmer"></div>' +
          '<div class="book-info">' +
            '<div class="skeleton-line skeleton-tag skeleton-shimmer"></div>' +
            '<div class="skeleton-line skeleton-title skeleton-shimmer"></div>' +
            '<div class="skeleton-line skeleton-author skeleton-shimmer"></div>' +
          '</div>' +
        '</div>';
    }
    return html;
  }

  function showLoadingState() {
    emptyState.hidden = true;
    pagination.hidden = true;
    connectionNotice.hidden = true;
    resultsMeta.textContent = 'กำลังโหลดข้อมูลหนังสือจาก Google Sheet...';
    bookGrid.innerHTML = skeletonMarkup(8);
  }

  function showConnectionNotice(message) {
    connectionNoticeText.textContent =
      'เชื่อมต่อ Google Sheet ไม่สำเร็จ (' + message + ') — กำลังแสดงข้อมูลตัวอย่างแทนไปก่อน';
    connectionNotice.hidden = false;
  }

  async function loadBooks() {
    showLoadingState();
    try {
      const rows = await fetchSheetValues();
      const books = rowsToBooks(rows);
      if (!books.length) throw new Error('ไม่พบแถวข้อมูลหนังสือในชีต');
      BOOKS = books;
      connectionNotice.hidden = true;
    } catch (err) {
      BOOKS = FALLBACK_BOOKS;
      showConnectionNotice(err.message);
    }

    FILTER_CATEGORIES = buildFilterCategories(BOOKS);
    activeCategory = 'ทั้งหมด';
    currentPage = 1;
    renderFilters();
    renderBooks();
  }

  retryConnectionBtn.addEventListener('click', loadBooks);

  /* ------------------------------------------------------------------------
     6. Render: filter pills
     ------------------------------------------------------------------------ */
  function renderFilters() {
    filterRow.innerHTML = FILTER_CATEGORIES.map(function (cat) {
      const isActive = cat === activeCategory;
      return '<button type="button" class="filter-pill' + (isActive ? ' active' : '') +
        '" data-category="' + escapeHtml(cat) + '" aria-pressed="' + isActive + '">' +
        escapeHtml(cat) + '</button>';
    }).join('');
  }

  filterRow.addEventListener('click', function (e) {
    const pill = e.target.closest('.filter-pill');
    if (!pill) return;
    activeCategory = pill.dataset.category;
    currentPage = 1;
    renderFilters();
    renderBooks();
  });

  /* ------------------------------------------------------------------------
     7. Render: book grid
     ------------------------------------------------------------------------ */
  function getFilteredBooks() {
    const term = searchTerm.trim().toLowerCase();
    return BOOKS.filter(function (book) {
      const matchesCategory = activeCategory === 'ทั้งหมด' || book.category === activeCategory;
      if (!matchesCategory) return false;
      if (!term) return true;
      return (
        book.title.toLowerCase().includes(term) ||
        book.author.toLowerCase().includes(term) ||
        book.category.toLowerCase().includes(term) ||
        (book.faculty && book.faculty.toLowerCase().includes(term)) ||
        (book.tags && book.tags.some(function (t) { return t.toLowerCase().includes(term); }))
      );
    });
  }

  function bookCoverMarkup(book) {
    const catIndex = categoryIndex(book.category);
    if (book.image) {
      return '<img class="book-cover-img" src="' + escapeHtml(book.image) + '" alt="ปกหนังสือ ' + escapeHtml(book.title) + '" loading="lazy">' +
        stampMarkup(book.year);
    }
    return '<div class="book-cover-generated cover-cat-' + catIndex + '">' +
      '<span class="cover-glyph">' + escapeHtml(coverGlyph(book.title)) + '</span>' +
      '</div>' + stampMarkup(book.year);
  }

  function stampMarkup(year) {
    return '<div class="cover-stamp" aria-hidden="true">' +
      '<span class="cover-stamp-label">พ.ศ.</span>' +
      '<span class="cover-stamp-year">' + escapeHtml(year) + '</span>' +
      '</div>';
  }

  function renderBooks() {
    const filtered = getFilteredBooks();
    const totalResults = filtered.length;
    const totalPages = Math.max(1, Math.ceil(totalResults / ITEMS_PER_PAGE));

    // Keep currentPage in range if the result set shrank (e.g. a new
    // search narrowed things down to fewer pages than before).
    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;

    resultsMeta.innerHTML = 'พบทั้งหมด <strong>' + totalResults + '</strong> เล่ม' +
      (activeCategory !== 'ทั้งหมด' ? ' ในหมวด "' + escapeHtml(activeCategory) + '"' : '');

    if (totalResults === 0) {
      bookGrid.innerHTML = '';
      emptyState.hidden = false;
      pagination.hidden = true;
      return;
    }
    emptyState.hidden = true;

    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const pageItems = filtered.slice(startIndex, startIndex + ITEMS_PER_PAGE);

    renderPagination(totalResults, totalPages, startIndex, pageItems.length);

    bookGrid.innerHTML = pageItems.map(function (book, i) {
      return (
        '<article class="book-card" tabindex="0" role="button" ' +
        'aria-label="เปิดรายละเอียด ' + escapeHtml(book.title) + '" ' +
        'data-id="' + book.id + '" style="animation-delay:' + Math.min(i * 35, 350) + 'ms">' +
          '<div class="book-cover">' + bookCoverMarkup(book) + '</div>' +
          '<div class="book-info">' +
            '<span class="book-category-tag">' + escapeHtml(book.category) + '</span>' +
            '<h3 class="book-title">' + escapeHtml(book.title) + '</h3>' +
            '<p class="book-author">' + escapeHtml(book.author) + '</p>' +
          '</div>' +
        '</article>'
      );
    }).join('');
  }

  function renderPagination(totalResults, totalPages, startIndex, pageCount) {
    if (totalPages <= 1) {
      pagination.hidden = true;
      return;
    }
    pagination.hidden = false;

    pageIndicator.textContent = 'หน้าที่ ' + currentPage + ' จาก ' + totalPages + ' หน้า';

    prevPageBtn.disabled = currentPage <= 1;
    nextPageBtn.disabled = currentPage >= totalPages;
  }

  function goToPage(page) {
    currentPage = page;
    renderBooks();
    // Bring the top of the grid into view so the new page starts on screen
    document.getElementById('bookGrid').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  prevPageBtn.addEventListener('click', function () {
    if (currentPage > 1) goToPage(currentPage - 1);
  });

  nextPageBtn.addEventListener('click', function () {
    goToPage(currentPage + 1);
  });

  bookGrid.addEventListener('click', function (e) {
    const card = e.target.closest('.book-card');
    if (!card) return;
    openModal(Number(card.dataset.id));
  });

  bookGrid.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const card = e.target.closest('.book-card');
    if (!card) return;
    e.preventDefault();
    openModal(Number(card.dataset.id));
  });

  /* ------------------------------------------------------------------------
     8. Search
     ------------------------------------------------------------------------ */
  searchInput.addEventListener('input', function () {
    searchTerm = searchInput.value;
    clearSearchBtn.hidden = searchTerm.length === 0;
    currentPage = 1;
    renderBooks();
  });

  clearSearchBtn.addEventListener('click', function () {
    searchInput.value = '';
    searchTerm = '';
    clearSearchBtn.hidden = true;
    currentPage = 1;
    searchInput.focus();
    renderBooks();
  });

  /* ------------------------------------------------------------------------
     9. Modal
     ------------------------------------------------------------------------ */
  function openModal(id) {
    const book = BOOKS.find(function (b) { return b.id === id; });
    if (!book) return;

    lastFocusedElement = document.activeElement;

    modalCategory.textContent = book.category;
    modalTitle.textContent = book.title;
    modalAuthorName.textContent = book.author || 'ไม่ระบุผู้เขียน';
    modalYear.textContent = book.year || '—';
    modalPages.textContent = book.pages ? (book.pages + ' หน้า') : '—';
    modalCategoryText.textContent = book.category;

    if (book.faculty) {
      modalFacultyRow.hidden = false;
      modalFaculty.textContent = book.faculty;
    } else {
      modalFacultyRow.hidden = true;
    }

    if (book.tags && book.tags.length) {
      modalTags.hidden = false;
      modalTags.innerHTML = book.tags.map(function (t) {
        return '<span class="modal-tag">' + escapeHtml(t) + '</span>';
      }).join('');
    } else {
      modalTags.hidden = true;
      modalTags.innerHTML = '';
    }

    modalDescription.innerHTML = book.description.map(function (para) {
      return '<p>' + escapeHtml(para) + '</p>';
    }).join('');

    const catIndex = categoryIndex(book.category);
    modalCover.className = 'modal-cover' + (book.image ? '' : ' cover-cat-' + catIndex);
    modalCover.innerHTML = book.image
      ? '<img src="' + escapeHtml(book.image) + '" alt="ปกหนังสือ ' + escapeHtml(book.title) + '">'
      : '<span class="cover-glyph">' + escapeHtml(coverGlyph(book.title)) + '</span>';

    modalEbookLink.href = book.ebookLink || '#';
    modalFulltextLink.href = book.fulltextLink || '#';

    modal.hidden = false;
    document.body.style.overflow = 'hidden';
    modalClose.focus();
  }

  function closeModal() {
    modal.hidden = true;
    document.body.style.overflow = '';
    if (lastFocusedElement) lastFocusedElement.focus();
  }

  modalClose.addEventListener('click', closeModal);

  // Close when clicking the dark backdrop (outside the modal card)
  modal.addEventListener('click', function (e) {
    if (e.target === modal) closeModal();
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !modal.hidden) closeModal();
  });

  /* ------------------------------------------------------------------------
     10. Init
     ------------------------------------------------------------------------ */
  loadBooks();

})();
