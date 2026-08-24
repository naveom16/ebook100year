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
    'วิศวกรรม คอมพิวเตอร์ และเทคโนโลยี',
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

  function cleanTitle(title) {
    return title.replace(/https?:\/\/[a-zA-Z0-9./_-]+/, '');
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
      console.log('CSV headers:', headers);
      const idx = {};
      headers.forEach(function (h, i) { idx[h] = i; });
      console.log('CSV column index:', idx);

      const required = ['title', 'author', 'year', 'page', 'description', 'category'];
      for (const r of required) {
        if (idx[r] === undefined) throw new Error('ขาดคอลัมน์: ' + r);
      }

      BOOKS = parsed.slice(1).map(function (row, rowIndex) {
        if (row.length !== headers.length) {
          console.warn('Row ' + rowIndex + ' column count mismatch: expected ' + headers.length + ', got ' + row.length, row);
        }
        const get = (col, def) => (idx[col] !== undefined && row[idx[col]] !== undefined) ? row[idx[col]].trim() : def;
        const book = {
          id: String(rowIndex + 1),
          title: get('title', ''),
          author: get('author', ''),
          faculty: get('faculty', ''),
          year: get('year', ''),
          pages: get('page', ''),
          category: get('category', ''),
          image: normalizeDriveUrl(get('cover_url', '')),
          ebookLink: get('pdf_url', '#'),
          fulltextLink: get('fulltext_url', '#'),
          tags: splitTags(get('tags', '')),
          description: splitDescription(get('description', ''))
        };
        if (rowIndex < 3) console.log('Parsed book ' + rowIndex + ':', book);
        return book;
      }).filter(function (b) { return b.title && b.category; });

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
    return '<div class="book-cover-generated cover-cat-' + catIndex + '">' +
      '<span class="cover-glyph">' + escapeHtml(coverGlyph(cleanTitle(book.title))) + '</span>' +
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
      const tagsHtml = book.tags.map(function (t) {
        return '<span class="book-tag">' + escapeHtml(t) + '</span>';
      }).join('');
      return (
        '<article class="book-card" tabindex="0" role="button" ' +
        'aria-label="เปิดรายละเอียด ' + escapeHtml(book.title) + '" ' +
        'data-id="' + escapeHtml(book.id) + '" style="animation-delay:' + (isInitialRender ? '0' : Math.min(i * 35, 350)) + 'ms">' +
          '<div class="book-cover">' + bookCoverMarkup(book) + '</div>' +
          '<div class="book-info">' +
            '<span class="book-category-tag">' + escapeHtml(book.category) + '</span>' +
            '<h3 class="book-title">' + escapeHtml(cleanTitle(book.title)) + '</h3>' +
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
        transitionPage(renderBooks, function () {
          bookGrid.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
      }
    });

    nextPageBtn.addEventListener('click', function () {
      const filtered = getFilteredBooks();
      const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
      if (currentPage < totalPages && !bookGrid.classList.contains('is-fading')) {
        currentPage++;
        transitionPage(renderBooks, function () {
          bookGrid.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
      }
    });
  }

  renderFilters();
  renderStatus();
  fetchBooks();

})();
