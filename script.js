/* ==========================================================================
   ตำรา ๑๐๐ ปี eBooks — script.js
   Handles: book data from Google Sheets CSV, rendering, search, category
   filtering, and the book-detail modal.
   ========================================================================== */

(function () {
  'use strict';

  const CATEGORIES = [
    'การศึกษาและจิตวิทยา',
    'ศิลปะและวัฒนธรรม',
    'ภาษา วรรณกรรม และการสื่อสาร',
    'สังคม การเมือง และกฎหมาย',
    'ศาสนาและปรัชญา',
    'ธุรกิจ การจัดการ และการท่องเที่ยว',
    'ประวัติศาสตร์ ภูมิศาสตร์ และโบราณคดี',
    'วิศว工程 คอมพิวเตอร์ และเทคโนโลยี',
    'วิทยาศาสตร์กายภาพและชีวภาพ',
    'วิทยาศาสตร์ สุขภาพ และสิ่งแวดล้อม'
  ];

  const SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/1hfqwP3KlakzE8HDovKVRzRy0y2j2on79QbkfwNfAD18/export?format=csv';

  let BOOKS = [];
  let activeCategory = 'ทั้งหมด';
  let searchTerm = '';
  let lastFocusedElement = null;
  let loading = true;
  let loadError = null;
  let currentPage = 1;
  const ITEMS_PER_PAGE = 12;
  let isInitialRender = true;

  const bookGrid = document.getElementById('bookGrid');
  const filterRow = document.getElementById('filterRow');
  const searchInput = document.getElementById('searchInput');
  const clearSearchBtn = document.getElementById('clearSearch');
  const resultsMeta = document.getElementById('resultsMeta');
  const emptyState = document.getElementById('emptyState');
  const errorState = document.getElementById('errorState');
  const prevPageBtn = document.getElementById('prevPage');
  const nextPageBtn = document.getElementById('nextPage');
  const pageInfo = document.getElementById('pageInfo');

  const modal = document.getElementById('bookModal');
  const modalClose = document.getElementById('modalClose');
  const modalCover = document.getElementById('modalCover');
  const modalCategory = document.getElementById('modalCategory');
  const modalTitle = document.getElementById('modalTitle');
  const modalAuthor = document.getElementById('modalAuthor');
  const modalYear = document.getElementById('modalYear');
  const modalPages = document.getElementById('modalPages');
  const modalCategoryText = document.getElementById('modalCategoryText');
  const modalDescription = document.getElementById('modalDescription');
  const modalEbookLink = document.getElementById('modalEbookLink');
  const modalFulltextLink = document.getElementById('modalFulltextLink');
  const modalFaculty = document.getElementById('modalFaculty');
  const modalTags = document.getElementById('modalTags');

  function cleanTitle(rawTitle) {
    if (!rawTitle || typeof rawTitle !== 'string') return '';
    console.log('Original title:', rawTitle);

    let cleaned = rawTitle;

    // 1) Known metadata-column prefixes accidentally pasted into the title
    //    cell (e.g. "url_ Understanding Literature"). Anchored to the very
    //    start and only ever consumes the literal prefix word + separators,
    //    so it can never eat into the real title.
    cleaned = cleaned.replace(/^(?:fulltext_url|ebook_url|pdf_url|url_|link_)[_\-\s]*/i, '');

    // 2) Markdown-style links "[label](url)" - bounded by [] and (), so this
    //    can't bleed past its own brackets into surrounding text.
    cleaned = cleaned.replace(/\[[^\]]*\]\([^)]*\)/g, '');

    // 3) DEFENSIVE FIX for the reported bug: sometimes a Google
    //    Drive/Docs/Forms link gets pasted directly in front of the title
    //    with NO separating space, e.g.
    //    "https://docs.google.com/document/d/xxx/editUnderstanding Literature".
    //    The OLD code matched URL characters with a case-insensitive
    //    character class that included plain letters (a-z/A-Z) and had no
    //    requirement to stop at a word boundary, so it kept consuming
    //    straight through "editUnderstanding" and swallowed the first word
    //    of the title along with the URL. Here we insert a boundary space
    //    right after well-known link terminators BEFORE doing any removal,
    //    so the URL becomes its own separate, whitespace-delimited token.
    cleaned = cleaned.replace(
      /(\/edit|\/view|\/preview|\/copy|\/pubhtml|\/pub|\?usp=sharing|\?usp=drive_link|&usp=sharing)(?=[^\s])/gi,
      '$1 '
    );

    // 3b) CONFIRMED ROOT CAUSE (row 96, "จุลชีพที่สำคัญทางสาธารณสุข"): a bare
    //     link with NO recognizable terminator (e.g. a raw forms.gle share
    //     link) glued directly onto a Thai title with zero separator, e.g.
    //     "https://forms.gle/X9b16pteLh8eg7ZU6จุลชีพที่สำคัญทางสาธารณสุข".
    //     Thai script (U+0E00-U+0E7F) can never legally appear inside a
    //     URL, so the first Thai character right after a URL-looking
    //     prefix is a 100% safe, unambiguous boundary to split on - unlike
    //     English titles, this case can be solved with certainty.
    cleaned = cleaned.replace(
      /((?:https?:\/\/|www\.|forms\.gle\/|drive\.google\.com\/|docs\.google\.com\/)[^\s\u0E00-\u0E7F]+)(?=[\u0E00-\u0E7F])/gi,
      '$1 '
    );

    // 3c) CONFIRMED ROOT CAUSE (2nd occurrence of the SAME row, English
    //     title version): the identical forms.gle link glued to an English
    //     title with zero separator, e.g.
    //     "https://forms.gle/X9b16pteLh8eg7ZU6English for Understanding...".
    //     Thai-boundary detection doesn't apply here since both the link
    //     and the title use Latin letters. Instead we use the fact that
    //     Google Drive/Forms IDs are random strings that always contain at
    //     least one digit, while real English title words never contain
    //     digits - so the LAST digit in the glued run marks the true end
    //     of the id, and the pure-letter run right after it is the start
    //     of the title. The lookahead+backreference (\2) makes this an
    //     "atomic" match so the engine can't backtrack into a false match
    //     partway through the id (which would otherwise happen because ids
    //     mix letters and digits); the split is only made when what
    //     follows is a clean, whole word immediately followed by
    //     whitespace or the end of the string.
    cleaned = cleaned.replace(
      /((?:https?:\/\/|www\.|forms\.gle\/|drive\.google\.com\/|docs\.google\.com\/)(?=([A-Za-z0-9._~:/?#\[\]@!$&'()*+,;=%-]*\d))\2)([A-Za-z]{2,})(?=\s|$)/g,
      '$1 $3'
    );

    // 4) Remove URLs, but ONLY when a URL is a WHOLE whitespace-delimited
    //    token (^...$ anchors on the token itself, not the full string).
    //    This is the key safety property that the old regex lacked: a
    //    token is either entirely a URL (and gets removed) or entirely a
    //    real word (and is always kept in full) - there is no way for this
    //    to trim, truncate, or partially delete a title word.
    const urlTokenPattern = /^(?:https?:\/\/|www\.|forms\.gle\/|drive\.google\.com\/|docs\.google\.com\/)[^\s]*$/i;
    const parts = cleaned.split(/\s+/).filter(function (w) {
      if (!w) return false;
      const isUrl = urlTokenPattern.test(w);
      if (isUrl) console.log('Removed URL token from title:', w);
      return !isUrl;
    });
    cleaned = parts.join(' ').trim();

    // 5) Diagnostic only - never deletes anything. If a URL is still glued
    //    to text with no space and no recognizable terminator (step 3
    //    couldn't split it), flag it so the sheet can be fixed at the
    //    source instead of guessing where the URL ends and the title
    //    begins.
    if (/^(?:https?:\/\/|www\.)[^\s]*[A-Za-zก-๙]{4,}/i.test(cleaned)) {
      console.warn('Possible URL glued to title text with no separator - please check the source row:', rawTitle);
    }

    console.log('After cleanTitle:', cleaned);
    return cleaned;
  }

  function categoryIndex(category) {
    const i = CATEGORIES.indexOf(category);
    return i === -1 ? 0 : i % 10;
  }

  function coverGlyph(title) {
    return title.length > 40 ? title.slice(0, 40) + '…' : title;
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function normalizeDriveUrl(url) {
    if (!url || typeof url !== 'string') return '';
    const m = url.match(/drive\.google\.com\/file\/d\/([^\/?]+)/);
    if (!m) return url;
    return 'https://drive.google.com/uc?id=' + m[1];
  }

  function sanitizeImageUrl(url) {
    if (!url || typeof url !== 'string') return '';

    // --- Private/local address detection (PNA / blocked by GitHub Pages) ---
    // A public HTTPS page cannot load images from RFC1918 / loopback hosts.
    try {
      const parsed = new URL(url);
      const host = parsed.hostname.toLowerCase();
      const isPrivate =
        host === 'localhost' ||
        host === '::1' ||
        host === '127.0.0.1' ||
        /^192\.168\./.test(host) ||
        /^10\./.test(host) ||
        /^172\.(1[6-9]|2\d|3[01])\./.test(host);
      if (isPrivate) {
        console.warn('PRIVATE/LOCAL COVER URL (blocked by browser/PNA, fix the Google Sheet row):', url);
      }
    } catch (e) {
      // not a parseable URL - leave as-is, the <img> will simply fail to load
    }

    // Percent-encode reserved characters that escapeHtml() does NOT handle,
    // so a raw URL like ".../file (1).jpg" is safe inside an src attribute.
    return url
      .replace(/ /g, '%20')
      .replace(/\[/g, '%5B')
      .replace(/\]/g, '%5D')
      .replace(/\(/g, '%28')
      .replace(/\)/g, '%29')
      .replace(/"/g, '%22')
      .replace(/'/g, '%27');
  }

  function parseCsv(text) {
    const rows = [];
    let row = [];
    let cell = '';
    let i = 0;
    let inQuotes = false;

    function flushCell() {
      row.push(cell);
      cell = '';
    }

    function flushRow() {
      if (row.length > 0) {
        rows.push(row);
        row = [];
      }
    }

    while (i < text.length) {
      const ch = text[i];

      if (inQuotes) {
        if (ch === '"') {
          if (i + 1 < text.length && text[i + 1] === '"') {
            cell += '"';
            i += 2;
          } else {
            inQuotes = false;
            i++;
          }
        } else {
          cell += ch;
          i++;
        }
      } else {
        if (ch === '"') {
          inQuotes = true;
          i++;
        } else if (ch === ',') {
          flushCell();
          i++;
        } else if (ch === '\r') {
          i++;
        } else if (ch === '\n') {
          flushRow();
          i++;
        } else {
          cell += ch;
          i++;
        }
      }
    }

    flushCell();
    flushRow();
    return rows;
  }

  function splitTags(raw) {
    if (!raw || !raw.trim()) return [];
    return raw.split(',').map(function (t) { return t.trim(); }).filter(Boolean);
  }

  function splitDescription(raw) {
    if (!raw) return [''];
    return raw.split(/\r?\n/).map(function (p) { return p.trim(); }).filter(Boolean);
  }

  async function fetchBooks() {
    loading = true;
    loadError = null;
    isInitialRender = true;
    renderStatus();
    const startTime = Date.now();

    try {
      const res = await fetch(SHEET_CSV_URL);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      let text = await res.text();
      if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
      const parsed = parseCsv(text);
      if (parsed.length < 2) throw new Error('CSV ว่างหรือไม่มีหัวตาราง');
      const headers = parsed[0].map(function (h) { return h.trim().toLowerCase(); });
      // --- DEBUG 7: raw headers exactly as parsed from the sheet ---
      console.log('CSV headers:', headers);
      console.log(headers);
      const idx = {};
      headers.forEach(function (h, i) { idx[h] = i; });
      console.log('CSV column index:', idx);
      // --- DEBUG 2: which column index "title" was resolved to ---
      console.log('TITLE COLUMN INDEX:', idx['title']);

      const required = ['title', 'author', 'year', 'page', 'description', 'category'];
      for (const r of required) {
        if (idx[r] === undefined) throw new Error('ขาดคอลัมน์: ' + r);
      }

      // CONFIRMED ROOT CAUSE (schema-level): the header row is missing a
      // name for one or more columns the app actually relies on (e.g.
      // "fulltext_url"), even though data rows do contain that data in a
      // trailing column. Because idx['fulltext_url'] ends up undefined,
      // get('fulltext_url', '#') silently falls back to '#' for every
      // single row - this is why "ขอตำราฉบับเต็ม" links are broken sheet-wide,
      // and it's very likely what pushed someone to paste the fulltext_url
      // value directly into the title cell for row 96 as a workaround.
      // This can't be safely auto-corrected in code (we'd be guessing which
      // trailing column is which) - it must be fixed by adding the missing
      // header name(s) to row 1 of the Google Sheet.
      const optionalButUsed = ['faculty', 'tags', 'cover_url', 'pdf_url', 'fulltext_url'];
      const missingOptional = optionalButUsed.filter(function (c) { return idx[c] === undefined; });
      if (missingOptional.length > 0) {
        console.error('HEADER SCHEMA MISMATCH: the sheet header row is missing column name(s): ' + missingOptional.join(', ') + '. Data in these columns will not be read correctly (values default to blank/"#"). Add these exact header names to row 1 of the Google Sheet.');
      }

      let mismatchCount = 0;

      BOOKS = parsed.slice(1).map(function (row, rowIndex) {
        // --- DEBUG 1: raw row exactly as returned by parseCsv(), before
        //     any column mapping / trimming is applied ---
        console.log('RAW CSV ROW:', row);

        // --- DEBUG 8: column count vs expected header count, for every row ---
        console.log('Row:', rowIndex, 'Columns:', row.length, 'Expected:', headers.length);
        if (row.length !== headers.length) {
          mismatchCount++;
          console.warn('Row ' + rowIndex + ' column count mismatch: expected ' + headers.length + ', got ' + row.length, row);
          console.warn('MISMATCHED ROW SAMPLE DATA (row ' + rowIndex + '):', JSON.stringify(row));
        }

        // --- DEBUG 2 (cont.): raw value pulled directly from the title column ---
        console.log('RAW TITLE:', row[idx['title']]);

        const get = (col, def) => (idx[col] !== undefined && row[idx[col]] !== undefined) ? row[idx[col]].trim() : def;
        const book = {
          id: String(rowIndex + 1),
          title: get('title', ''),
          author: get('author', ''),
          faculty: get('faculty', ''),
          year: get('year', ''),
          pages: get('page', ''),
          category: get('category', ''),
          image: sanitizeImageUrl(normalizeDriveUrl(get('cover_url', ''))),
          ebookLink: get('pdf_url', '#'),
          fulltextLink: get('fulltext_url', '#'),
          tags: splitTags(get('tags', '')),
          description: splitDescription(get('description', ''))
        };

        // --- DEBUG 3: the fully-assembled book object ---
        console.log('BOOK OBJECT:', book);

        // --- DEBUG 9: the final sanitized/normalized cover URL for this row ---
        console.log('BOOK IMAGE:', book.image);

        if (rowIndex < 3) console.log('Parsed book ' + rowIndex + ':', book);
        return book;
      });

      // --- EXTRA DEBUG (not explicitly requested, but directly relevant to
      //     "บาง title ไม่แสดงเลย"): the final .filter() drops any book whose
      //     title or category ended up empty/falsy after parsing. If a title
      //     is missing entirely from the rendered grid, this is the first
      //     place to check - it means `book.title` or `book.category` was
      //     falsy at this point, NOT that render logic hid it. ---
      const droppedBooks = BOOKS.filter(function (b) { return !(b.title && b.category); });
      if (droppedBooks.length > 0) {
        console.warn('BOOKS DROPPED BY title/category FILTER (never rendered):', droppedBooks.length);
        droppedBooks.forEach(function (b) {
          console.warn('  Dropped book id=' + b.id + ' | title="' + b.title + '" | category="' + b.category + '"');
        });
      }
      BOOKS = BOOKS.filter(function (b) { return b.title && b.category; });

      // --- DEBUG 8 (summary): total number of rows where column count
      //     didn't match the header count ---
      console.log('TOTAL COLUMN-COUNT MISMATCHES:', mismatchCount, 'out of', parsed.length - 1, 'rows');

      loading = false;
    } catch (e) {
      loading = false;
      loadError = e.message || String(e);
    }

    const elapsed = Date.now() - startTime;
    if (elapsed < 500) {
      await new Promise(function (r) { setTimeout(r, 500 - elapsed); });
    }

    currentPage = 1;
    renderStatus();
    renderFilters();
    renderBooks();
    isInitialRender = false;
  }

  function renderStatus() {
    if (loading) {
      bookGrid.innerHTML = '';
      emptyState.hidden = true;
      if (errorState) errorState.hidden = true;
      renderSkeleton();
      return;
    }
    if (loadError) {
      bookGrid.innerHTML = '';
      emptyState.hidden = true;
      if (errorState) {
        errorState.hidden = false;
        errorState.querySelector('.error-message').textContent = 'ไม่สามารถโหลดข้อมูลได้: ' + loadError;
      }
      return;
    }
    if (errorState) errorState.hidden = true;
  }

  function renderSkeleton() {
    bookGrid.innerHTML = Array.from({ length: 12 }, function () {
      return (
        '<div class="skeleton-card" aria-hidden="true">' +
          '<div class="skeleton-cover"></div>' +
          '<div class="skeleton-body">' +
            '<div class="skeleton-line"></div>' +
            '<div class="skeleton-line short"></div>' +
          '</div>' +
        '</div>'
      );
    }).join('');
  }

  function renderFilters() {
    const all = ['ทั้งหมด', ...CATEGORIES];
    filterRow.innerHTML = all.map(function (cat) {
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
    // --- DEBUG 5/6: title value right before and right after cleanTitle() ---
    console.log('BEFORE CLEAN:', book.title);
    const cleaned = cleanTitle(book.title);
    console.log('AFTER CLEAN:', cleaned);
    return '<div class="book-cover-generated cover-cat-' + catIndex + '">' +
      '<span class="cover-glyph">' + escapeHtml(coverGlyph(cleaned)) + '</span>' +
      '</div>' + stampMarkup(book.year);
  }

  function stampMarkup(year) {
    return '<div class="cover-stamp" aria-hidden="true">' +
      '<span class="cover-stamp-year">' + escapeHtml(year) + '</span>' +
      '<span class="cover-stamp-label">พ.ศ.</span>' +
      '</div>';
  }

  function renderBooks() {
    if (loading || loadError) return;
    const filtered = getFilteredBooks();

    resultsMeta.innerHTML = 'พบ <strong>' + filtered.length + '</strong> รายการ' +
      (activeCategory !== 'ทั้งหมด' ? ' ในหมวด "' + escapeHtml(activeCategory) + '"' : '');

    const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
    if (currentPage > totalPages) currentPage = totalPages;

    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    const pageItems = filtered.slice(start, start + ITEMS_PER_PAGE);

    if (pageItems.length === 0) {
      bookGrid.innerHTML = '';
      emptyState.hidden = false;
      updatePagination(filtered.length);
      return;
    }
    emptyState.hidden = true;

    bookGrid.innerHTML = pageItems.map(function (book, i) {
      // --- DEBUG 4: title value as the book card is about to be rendered ---
      console.log('RENDER TITLE:', book.title);
      const tagsHtml = book.tags.map(function (t) {
        return '<span class="book-tag">' + escapeHtml(t) + '</span>';
      }).join('');
      // --- DEBUG 5/6: title value right before and right after cleanTitle() ---
      console.log('BEFORE CLEAN:', book.title);
      const cardTitle = cleanTitle(book.title);
      console.log('AFTER CLEAN:', cardTitle);
      return (
        '<article class="book-card" tabindex="0" role="button" ' +
        'aria-label="เปิดรายละเอียด ' + escapeHtml(book.title) + '" ' +
        'data-id="' + escapeHtml(book.id) + '" style="animation-delay:' + (isInitialRender ? '0' : Math.min(i * 35, 350)) + 'ms">' +
          '<div class="book-cover">' + bookCoverMarkup(book) + '</div>' +
          '<div class="book-info">' +
            '<span class="book-category-tag">' + escapeHtml(book.category) + '</span>' +
            '<h3 class="book-title">' + escapeHtml(cardTitle) + '</h3>' +
            '<p class="book-author">' + escapeHtml(book.author) + '</p>' +
            (book.faculty ? '<p class="book-faculty">' + escapeHtml(book.faculty) + '</p>' : '') +
            '<div class="book-tags-row">' + tagsHtml + '</div>' +
          '</div>' +
        '</article>'
      );
    }).join('');

    const images = bookGrid.querySelectorAll('.book-cover-img');
    images.forEach(function (img) {
      if (img.complete && img.naturalWidth > 0) {
        img.classList.add('loaded');
      } else {
        img.addEventListener('load', function () {
          img.classList.add('loaded');
        }, { once: true });
        img.addEventListener('error', function () {
          img.classList.add('loaded');
        }, { once: true });
      }
    });

    updatePagination(filtered.length);
  }

  function updatePagination(totalItems) {
    const totalPages = Math.max(1, Math.ceil(totalItems / ITEMS_PER_PAGE));
    pageInfo.textContent = 'หน้า ' + currentPage + ' จาก ' + totalPages;
    prevPageBtn.disabled = currentPage <= 1;
    nextPageBtn.disabled = currentPage >= totalPages;
  }

  function transitionPage(callback, onComplete) {
    if (bookGrid.classList.contains('is-fading')) return;
    const oldHeight = bookGrid.getBoundingClientRect().height;
    bookGrid.style.minHeight = oldHeight + 'px';

    const done = function () {
      bookGrid.style.minHeight = '';
      if (onComplete) onComplete();
    };

    if (document.startViewTransition) {
      const transition = document.startViewTransition(callback);
      transition.finished.then(done).catch(done);
    } else {
      bookGrid.classList.add('is-fading');
      setTimeout(function () {
        callback();
        bookGrid.classList.remove('is-fading');
        if (onComplete) {
          function handler(e) {
            if (e.propertyName !== 'opacity') return;
            bookGrid.removeEventListener('transitionend', handler);
            done();
          }
          bookGrid.addEventListener('transitionend', handler);
        }
      }, 240);
    }
  }

  bookGrid.addEventListener('click', function (e) {
    const card = e.target.closest('.book-card');
    if (!card) return;
    openModal(card.dataset.id);
  });

  bookGrid.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const card = e.target.closest('.book-card');
    if (!card) return;
    e.preventDefault();
    openModal(card.dataset.id);
  });

  searchInput.addEventListener('input', function () {
    searchTerm = searchInput.value;
    currentPage = 1;
    clearSearchBtn.hidden = searchTerm.length === 0;
    renderBooks();
  });

  clearSearchBtn.addEventListener('click', function () {
    searchInput.value = '';
    searchTerm = '';
    currentPage = 1;
    clearSearchBtn.hidden = true;
    searchInput.focus();
    renderBooks();
  });

  function openModal(id) {
    const book = BOOKS.find(function (b) { return b.id === id; });
    if (!book) return;

    lastFocusedElement = document.activeElement;

    modalCategory.textContent = book.category;
    modalTitle.textContent = cleanTitle(book.title);
    modalAuthor.textContent = book.author;
    modalYear.textContent = book.year;
    modalPages.textContent = book.pages + ' หน้า';
    modalCategoryText.textContent = book.category;

    if (modalFaculty) {
      modalFaculty.textContent = book.faculty || '';
      modalFaculty.style.display = book.faculty ? '' : 'none';
    }

    if (modalTags) {
      modalTags.innerHTML = book.tags.map(function (t) {
        return '<span class="modal-tag">' + escapeHtml(t) + '</span>';
      }).join('');
      modalTags.style.display = book.tags.length ? '' : 'none';
    }

    modalDescription.innerHTML = book.description.map(function (para) {
      return '<p>' + escapeHtml(para) + '</p>';
    }).join('');

    const catIndex = categoryIndex(book.category);
    modalCover.className = 'modal-cover' + (book.image ? '' : ' cover-cat-' + catIndex);
    modalCover.innerHTML = book.image
      ? '<img src="' + escapeHtml(book.image) + '" alt="ปกหนังสือ ' + escapeHtml(book.title) + '">'
      : '<span class="cover-glyph">' + escapeHtml(coverGlyph(cleanTitle(book.title))) + '</span>';

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

  modal.addEventListener('click', function (e) {
    if (e.target === modal) closeModal();
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !modal.hidden) closeModal();
  });

  const retryBtn = document.getElementById('retryBtn');
  if (retryBtn) {
    retryBtn.addEventListener('click', function () {
      fetchBooks();
    });
  }

  if (prevPageBtn && nextPageBtn) {
    prevPageBtn.addEventListener('click', function () {
      if (currentPage > 1 && !bookGrid.classList.contains('is-fading')) {
        currentPage--;
        bookGrid.scrollIntoView({ behavior: 'smooth', block: 'start' });
        transitionPage(renderBooks);
      }
    });

    nextPageBtn.addEventListener('click', function () {
      const filtered = getFilteredBooks();
      const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
      if (currentPage < totalPages && !bookGrid.classList.contains('is-fading')) {
        currentPage++;
        bookGrid.scrollIntoView({ behavior: 'smooth', block: 'start' });
        transitionPage(renderBooks);
      }
    });
  }

  renderFilters();
  renderStatus();
  fetchBooks();

})();
