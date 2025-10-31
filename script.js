document.addEventListener('DOMContentLoaded', () => {

    // --- CONFIGURATION ---
    const SPREADSHEET_KEY = '1PTUUduAtN-YYAZYvGhg_pmkQUh2-qjNNkc-ZNyWbTOY';
    
    const WEEK_RANGES = {
        'Wk 44': 'B2:M',
        'Wk 45': 'O2:Z',
        'Wk 46': 'AB2:AM',
        'Wk 47': 'AO2:AZ',
        'Wk 48': 'BB2:BM'
    };
    const WEEKS_ORDER = ['Wk 44', 'Wk 45', 'Wk 46', 'Wk 47', 'Wk 48'];

    const CATEGORY_MAP = {
        'A': 'Categoría A - Nota: (4 a 5]',
        'B': 'Categoría B - Nota: (3 a 4]',
        'C': 'Categoría C - Nota: (2 a 3]',
        'D': 'Categoría D - Nota: (1 a 2]',
        'E': 'Categoría E - Nota: [0 a 1]'
    };
    const CATEGORIES_ORDER = ['A', 'B', 'C', 'D', 'E'];
    // Se mantiene WEEKS para la lógica interna del MODAL de detalle
    const WEEKS = ['Wk 44', 'Wk 45', 'Wk 46', 'Wk 47', 'Wk 48'];

    // --- DOM ELEMENTS ---
    const loader = document.getElementById('loader');
    const themeToggle = document.getElementById('theme-toggle');
    const rankingList = document.getElementById('ranking-list');
    const weekControls = document.getElementById('week-controls');

    // Modal Detalle DOM Elements
    const modalOverlay = document.getElementById('modal-overlay');
    const detailsModal = document.getElementById('details-modal');
    const modalTitle = document.getElementById('modal-title');
    const modalCloseBtn = document.getElementById('modal-close-btn');
    const weekSelector = document.getElementById('week-selector');
    const modalTableContainer = document.getElementById('modal-table-container');
    
    // === NUEVO: Modal Tendencia DOM Elements ===
    const trendModalOverlay = document.getElementById('trend-modal-overlay');
    const trendModal = document.getElementById('trend-modal');
    const trendModalTitle = document.getElementById('trend-modal-title');
    const trendModalCloseBtn = document.getElementById('trend-modal-close-btn');
    const trendModalContent = document.getElementById('trend-modal-content');

    const db = { rankings: {} }; 
    const sheetCache = {}; 
    let currentWeek = ''; // Rastrea la semana activa

    // --- UTILITY FUNCTIONS ---
    const cleanNumber = (value) => {
        if (typeof value === 'number') return value;
        if (typeof value !== 'string' || value.trim() === '') return 0;
        return Number(value.replace(/\./g, '').replace(/,/g, '.')) || 0;
    };
    
    const cleanPercent = (value) => {
        if (typeof value !== 'string' || value.trim() === '') return 0;
        return Number(value.replace(/%/g, '').replace(/\./g, '').replace(/,/g, '.')) || 0;
    };

    function formatNumber(num) {
        if (typeof num !== 'number') return '0';
        return num.toLocaleString('es-CO', { maximumFractionDigits: 0 });
    }
    
    function formatDecimal(num) {
        if (typeof num !== 'number') return '0';
        return num.toLocaleString('es-CO', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    }

    function calculateWeekTotal(data, week, baseKey) {
        const columnKey = `${week} ${baseKey}`;
        if (!data[0] || !data[0].hasOwnProperty(columnKey)) {
            return 0; 
        }
        return data.reduce((acc, row) => acc + cleanNumber(row[columnKey]), 0);
    }

    // --- THEME ---
    function applyTheme(theme) { document.body.dataset.theme = theme; localStorage.setItem('dashboard-theme', theme); }
    

    // --- INITIALIZATION ---
    async function main() {
        showLoader(true);
        applyTheme(localStorage.getItem('dashboard-theme') || 'light');
        try {
            const availableWeeks = await initializeRankings(); 
            setupEventListeners(); 
            
            if (availableWeeks.length > 0) {
                const lastWeek = availableWeeks[availableWeeks.length - 1];
                handleWeekClick(lastWeek); // Llama al handler directamente
            } else {
                rankingList.innerHTML = '<p style="text-align: center; color: var(--text-secondary);">No se encontraron datos de ranking para ninguna semana.</p>';
                showLoader(false); 
            }
            
        } catch (error) {
            console.error("Dashboard Init Error:", error);
            alert("Error al cargar datos. Verifica el nombre de la hoja 'Ranking' y la publicación del Sheet.");
            showLoader(false);
        }
    }
    
    async function initializeRankings() {
        const availableWeeks = [];
        
        const fetchPromises = WEEKS_ORDER.map(week => {
            const range = WEEK_RANGES[week];
            return fetchRankingData(week, range);
        });

        const results = await Promise.allSettled(fetchPromises);

        results.forEach(result => {
            if (result.status === 'fulfilled' && result.value.hasData) {
                availableWeeks.push(result.value.week);
            } else if (result.status === 'rejected') {
                console.warn(`No se pudieron cargar los datos para ${result.reason.week || 'una semana'}: ${result.reason.message}`);
            }
        });

        renderWeekControls(availableWeeks);
        return availableWeeks;
    }


    // --- DATA FETCHING & PARSING ---
    async function fetchRankingData(week, range) {
        const DATA_URL = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_KEY}/gviz/tq?tqx=out:csv&sheet=Ranking&range=${range}`;

        const response = await fetch(DATA_URL);
        if (!response.ok) {
            throw new Error(`Failed to fetch sheet 'Ranking' for range ${range}`);
        }
        const csvData = await response.text();

        return new Promise((resolve, reject) => {
            Papa.parse(csvData, {
                skipEmptyLines: true,
                complete: (result) => {
                    if (result.data.length < 1) {
                        db.rankings[week] = [];
                        resolve({ week: week, hasData: false });
                        return;
                    }

                    const headers = result.data[0];
                    const rows = result.data.slice(1);
                    
                    const parsedData = rows.map(row => {
                        const rowData = {};
                        headers.forEach((header, i) => { 
                            rowData[header.trim()] = row[i]; 
                        });
                        
                        return {
                            'Top': cleanNumber(rowData['Top']),
                            'Nota': cleanNumber(rowData['Nota']),
                            'Categoria': rowData['Categoria'],
                            'Cuenta': rowData['Cuenta'],
                            'Likes Reconocidos': cleanNumber(rowData['Likes Reconocidos']),
                            '# Posts': cleanNumber(rowData['# Posts']),
                            'Likes Reales': cleanNumber(rowData['Likes Reales']),
                            '% Efectividad': rowData['% Efectividad'],
                            'Likes Perdidos': cleanNumber(rowData['Likes Perdidos']),
                            'Tope Maximo de likes': cleanNumber(rowData['Tope Maximo de likes']),
                            'Promedio': cleanNumber(rowData['Promedio']),
                            'Desviacion Estandar P': cleanNumber(rowData['Desviacion Estandar P'])
                        };
                    }).filter(row => row.Cuenta && row.Cuenta.trim() !== '');
                    
                    db.rankings[week] = parsedData;
                    const totalLikes = parsedData.reduce((acc, row) => acc + row['Likes Reconocidos'], 0);
                    
                    resolve({ week: week, hasData: totalLikes > 0 });
                },
                error: (err) => {
                    err.week = week; 
                    reject(err);
                }
            });
        });
    }
    
    // --- RENDERING ---
    
    function renderWeekControls(availableWeeks) {
        weekControls.innerHTML = ''; 
        
        if (availableWeeks.length === 0) {
            weekControls.innerHTML = '<p style="color: var(--text-secondary);">No hay semanas con datos disponibles.</p>';
            return;
        }
        
        availableWeeks.forEach(week => {
            const btn = document.createElement('button');
            btn.className = 'week-btn';
            btn.dataset.week = week;
            btn.textContent = week;
            weekControls.appendChild(btn);
        });
    }
    
    function renderRankingList(data, week) {
        rankingList.innerHTML = ''; 

        if (!data || data.length === 0) {
             rankingList.innerHTML = '<p style="text-align: center; color: var(--text-secondary);">No se encontraron datos para la semana seleccionada.</p>';
            return;
        }
        
        const weekIndex = WEEKS_ORDER.indexOf(week);
        let prevWeekData = null;
        if (weekIndex > 0) {
            const prevWeek = WEEKS_ORDER[weekIndex - 1];
            if (db.rankings[prevWeek]) {
                prevWeekData = new Map(db.rankings[prevWeek].map(item => [item['Cuenta'], item]));
            }
        }

        CATEGORIES_ORDER.forEach(category => {
            
            const categoryHeader = document.createElement('button');
            categoryHeader.className = 'category-header';
            categoryHeader.innerHTML = `
                <span>${CATEGORY_MAP[category] || `Categoría ${category}`}</span>
                <i class="fas fa-chevron-up"></i>
            `;
            categoryHeader.setAttribute('aria-expanded', 'true');
            
            const accountsWrapper = document.createElement('div');
            accountsWrapper.className = 'accounts-wrapper';

            const accountsInCategory = data.filter(item => item['Categoria'] === category);

            if (accountsInCategory.length === 0) {
                categoryHeader.classList.add('empty', 'collapsed');
                accountsWrapper.classList.add('collapsed');
                categoryHeader.setAttribute('aria-expanded', 'false');

                const emptyCard = document.createElement('div');
                emptyCard.className = 'empty-category-card card';
                emptyCard.textContent = `No hay cuentas en esta categoría.`;
                accountsWrapper.appendChild(emptyCard);
                
            } else {
                accountsInCategory.forEach((item) => {
                    const nota = item['Nota'];
                    const failClass = nota < 3 ? 'fail' : '';
                    
                    const card = document.createElement('div');
                    card.className = `ranking-item-card card`;
                    card.dataset.account = item['Cuenta'];
                    
                    const prevItem = prevWeekData ? prevWeekData.get(item['Cuenta']) : null;
                    
                    card.innerHTML = `
                        <div class="nota-badge ${failClass}" title="Nota">
                            ${formatDecimal(nota)}
                            ${createTrendIcon(item['Nota'], prevItem ? prevItem['Nota'] : null, 'Nota', 'number', item['Cuenta'])}
                        </div>
                        
                        <h3 class="account-name" title="${item['Cuenta']}">${item['Cuenta']}</h3>
                        
                        <div class="stat-item main-metric">
                            <span class="stat-label">Likes Reconocidos</span>
                            <span class="stat-value">${formatNumber(item['Likes Reconocidos'])}</span>
                            ${createTrendIcon(item['Likes Reconocidos'], prevItem ? prevItem['Likes Reconocidos'] : null, 'Likes Reconocidos', 'number', item['Cuenta'])}
                        </div>
                        
                        <div class="stat-item">
                            <span class="stat-label"># Posts</span>
                            <span class="stat-value">${formatNumber(item['# Posts'])}</span>
                            ${createTrendIcon(item['# Posts'], prevItem ? prevItem['# Posts'] : null, '# Posts', 'number', item['Cuenta'])}
                        </div>
                        
                        <div class="separator"></div>

                        <div class="stat-item">
                            <span class="stat-label">Likes Reales</span>
                            <span class="stat-value">${formatNumber(item['Likes Reales'])}</span>
                            ${createTrendIcon(item['Likes Reales'], prevItem ? prevItem['Likes Reales'] : null, 'Likes Reales', 'number', item['Cuenta'])}
                        </div>
                        
                        <div class="stat-item">
                            <span class="stat-label">% Efectividad</span>
                            <span class="stat-value gain">${item['% Efectividad']}</span>
                            ${createTrendIcon(cleanPercent(item['% Efectividad']), prevItem ? cleanPercent(prevItem['% Efectividad']) : null, '% Efectividad', 'pp', item['Cuenta'])}
                        </div>
                        
                        <div class="stat-item">
                            <span class="stat-label">Likes Perdidos</span>
                            <span class="stat-value loss">${formatNumber(item['Likes Perdidos'])}</span>
                            ${createTrendIcon(item['Likes Perdidos'], prevItem ? prevItem['Likes Perdidos'] : null, 'Likes Perdidos', 'number', item['Cuenta'])}
                        </div>
                        
                        <div class="separator"></div>

                        <div class="stat-item">
                            <span class="stat-label">Max Likes/Post</span>
                            <span class="stat-value">${formatNumber(item['Tope Maximo de likes'])}</span>
                            ${createTrendIcon(item['Tope Maximo de likes'], prevItem ? prevItem['Tope Maximo de likes'] : null, 'Max Likes/Post', 'number', item['Cuenta'])}
                        </div>
                        
                        <div class="symbol">=</div>

                        <div class="stat-item">
                            <span class="stat-label">Promedio Likes</span>
                            <span class="stat-value">${formatNumber(item['Promedio'])}</span>
                            ${createTrendIcon(item['Promedio'], prevItem ? prevItem['Promedio'] : null, 'Promedio Likes', 'number', item['Cuenta'])}
                        </div>
                        
                        <div class="symbol">+</div>
                        
                        <div class="stat-item">
                            <span class="stat-label">Desv. Est. P</span>
                            <span class="stat-value">${formatNumber(item['Desviacion Estandar P'])}</span>
                            ${createTrendIcon(item['Desviacion Estandar P'], prevItem ? prevItem['Desviacion Estandar P'] : null, 'Desv. Est. P', 'number', item['Cuenta'])}
                        </div>

                        <button class="detail-btn" data-account="${item['Cuenta']}">Ver detalle</button>
                    `;
                    accountsWrapper.appendChild(card);
                });
            }
            rankingList.appendChild(categoryHeader);
            rankingList.appendChild(accountsWrapper);
        });
    }
    
    /**
     * (ACTUALIZADO) - Cambia el icono neutral a "="
     */
    function createTrendIcon(currentVal, prevVal, metricName, unit, accountName) {
        if (prevVal === null || currentVal === null || typeof prevVal === 'undefined') return ''; 

        const diff = currentVal - prevVal;
        
        // === ACTUALIZADO (AJUSTE 1) ===
        let iconClass = 'neutral fas fa-equals'; // Cambiado a "="
        if (diff > 0.01) iconClass = 'gain fas fa-arrow-up';
        if (diff < -0.01) iconClass = 'loss fas fa-arrow-down';
        
        if (metricName === 'Likes Perdidos') {
            if (diff > 0) iconClass = 'loss fas fa-arrow-up'; 
            if (diff < 0) iconClass = 'gain fas fa-arrow-down'; 
        }

        return `<span class="trend-icon ${iconClass.split(' ')[0]}" 
                      data-metric="${metricName}" 
                      data-current="${currentVal}" 
                      data-prev="${prevVal}" 
                      data-unit="${unit}"
                      data-account="${accountName}">
                    <i class="${iconClass.split(' ')[1]} ${iconClass.split(' ')[2]}"></i>
                  </span>`;
    }

    
    // --- LÓGICA DEL MODAL DE DETALLE ---
    function showModalLoader(show) {
        if (show) {
            modalTableContainer.innerHTML = '<div class="modal-loader"></div>';
            const statsContainer = document.getElementById('modal-stats-container');
            if (statsContainer) {
                statsContainer.innerHTML = '';
            }
        } else {
            modalTableContainer.innerHTML = '';
        }
    }
    function openModal() {
        modalOverlay.classList.add('visible');
        detailsModal.classList.add('visible');
    }
    function closeModal() {
        modalOverlay.classList.remove('visible');
        detailsModal.classList.remove('visible');
    }
    async function openDetailsModal(accountName) {
        openModal();
        modalTitle.textContent = `Detalle: ${accountName}`;
        weekSelector.innerHTML = '';
        showModalLoader(true);
        try {
            const data = await fetchAccountData(accountName);
            buildModalContent(data);
        } catch (error) {
            console.error("Error fetching account data:", error);
            modalTableContainer.innerHTML = `<p style="color: var(--loss-color); text-align: center;">Error: No se pudo cargar la hoja de datos para "${accountName}". Verifica que el nombre de la hoja sea correcto y esté publicada.</p>`;
        }
    }
    async function fetchAccountData(accountName) {
        if (sheetCache[accountName]) return sheetCache[accountName];
        const sheetUrl = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_KEY}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(accountName)}`;
        const response = await fetch(sheetUrl);
        if (!response.ok) throw new Error(`Sheet not found or not published: ${accountName}`);
        const csvData = await response.text();
        return new Promise((resolve, reject) => {
            Papa.parse(csvData, {
                header: true, skipEmptyLines: true,
                complete: (result) => {
                    const data = result.data.map(row => {
                        const cleanedRow = {};
                        for (const key in row) cleanedRow[key.trim()] = row[key];
                        return cleanedRow;
                    }).filter(row => row.Fecha_Publicacion);
                    sheetCache[accountName] = data; resolve(data);
                }, error: (err) => reject(err)
            });
        });
    }
    
    /**
     * (MODIFICADO) CONSTRUYE EL CONTENIDO DEL MODAL DE DETALLE
     */
    function buildModalContent(data) {
        weekSelector.innerHTML = '';
        
        // 1. Encuentra semanas disponibles en la hoja de DETALLE de la cuenta
        const availableWeeks = WEEKS.filter(wk => {
            const likesKey = `${wk} Likes`;
            if (!data[0] || !data[0].hasOwnProperty(likesKey)) return false;
            const sum = data.reduce((acc, row) => acc + cleanNumber(row[likesKey]), 0);
            return sum > 0;
        });

        if (availableWeeks.length === 0) {
            showModalLoader(false);
            modalTableContainer.innerHTML = `<p style="text-align: center;">No hay datos de semanas disponibles para esta cuenta.</p>`;
            return;
        }

        // 2. Crea los botones
        availableWeeks.forEach(wk => {
            const btn = document.createElement('button');
            btn.className = 'week-btn'; btn.dataset.week = wk; btn.textContent = wk;
            btn.addEventListener('click', () => {
                weekSelector.querySelectorAll('.week-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                renderModalTable(data, wk);
                renderWeekStats(data, wk, availableWeeks);
            });
            weekSelector.appendChild(btn);
        });

        // === 3. (AJUSTE 2) Intenta activar la 'currentWeek' global ===
        const defaultButton = weekSelector.querySelector(`button[data-week="${currentWeek}"]`);

        if (defaultButton) {
            defaultButton.click(); // Activa la semana global si existe
        } else if (weekSelector.lastChild) {
            weekSelector.lastChild.click(); // Fallback a la última disponible
        }
    }
    
    function renderWeekStats(data, selectedWeek, availableWeeks) {
        const statsContainer = document.getElementById('modal-stats-container');
        statsContainer.innerHTML = '';
        const weekIndex = WEEKS.indexOf(selectedWeek);
        const currentTotal = calculateWeekTotal(data, selectedWeek, 'Likes Reconocidos');
        let html = `<div class="modal-stat-card"><p>Total ${selectedWeek} (Likes Recon.)</p><div class="stat-value">${formatNumber(currentTotal)}</div></div>`;
        let prevWeekWasAvailable = false; let previousTotal = 0;
        if (weekIndex > 0) {
            const previousWeek = WEEKS[weekIndex - 1];
            if (availableWeeks.includes(previousWeek)) {
                prevWeekWasAvailable = true;
                previousTotal = calculateWeekTotal(data, previousWeek, 'Likes Reconocidos');
            }
        }
        if (prevWeekWasAvailable) {
            const diffQty = currentTotal - previousTotal;
            const diffPct = (previousTotal === 0) ? (currentTotal > 0 ? 1 : 0) : (diffQty / previousTotal);
            const qtyClass = diffQty > 0 ? 'positive' : (diffQty < 0 ? 'negative' : '');
            const qtySign = diffQty > 0 ? '+' : '';
            const pctClass = diffPct > 0 ? 'positive' : (diffPct < 0 ? 'negative' : '');
            const pctSign = diffPct > 0 ? '+' : '';
            html += `<div class="modal-stat-card"><p>vs. ${WEEKS[weekIndex - 1]} (Absoluto)</p><div class="stat-value ${qtyClass}">${qtySign}${formatNumber(diffQty)}</div></div>
                     <div class="modal-stat-card"><p>vs. ${WEEKS[weekIndex - 1]} (%)</p><div class="stat-value ${pctClass}">${pctSign}${diffPct.toLocaleString('es-CO', {style: 'percent', minimumFractionDigits: 1})}</div></div>`;
        } else {
            html += `<div class="modal-stat-card"><p>vs. Semana Anterior (Absoluto)</p><div class="stat-value">N/A</div></div>
                     <div class="modal-stat-card"><p>vs. Semana Anterior (%)</p><div class="stat-value">N/A</div></div>`;
        }
        statsContainer.innerHTML = html;
    }
    function renderModalTable(data, week) {
        showModalLoader(false);
        const likesRecKey = `${week} Likes Reconocidos`;
        const likesKey = `${week} Likes`;
        const likesPerdidosKey = `${week} Likes Perdidos`;
        const table = document.createElement('table');
        table.innerHTML = `<thead><tr><th>Fecha</th><th>Tipo</th><th>Likes Reconocidos</th><th>Likes Reales</th><th>Likes Perdidos</th><th>Enlace</th></tr></thead><tbody></tbody>`;
        const tbody = table.querySelector('tbody');
        data.forEach(row => {
            const tr = document.createElement('tr');
            const likesPerdidosValue = cleanNumber(row[likesPerdidosKey]);
            const lossClass = likesPerdidosValue !== 0 ? 'loss' : '';
            tr.innerHTML = `<td>${row['Fecha_Publicacion'] || ''}</td><td>${row['Tipo_Post'] || ''}</td><td>${formatNumber(cleanNumber(row[likesRecKey]))}</td><td>${formatNumber(cleanNumber(row[likesKey]))}</td><td class="${lossClass}">${formatNumber(likesPerdidosValue)}</td><td><a href="${row['Enlace'] || '#'}" target="_blank" rel="noopener noreferrer">Ver</a></td>`;
            tbody.appendChild(tr);
        });
        modalTableContainer.appendChild(table);
    }
    // --- FIN LÓGICA MODAL DETALLE ---
    

    // --- LÓGICA DEL MODAL DE TENDENCIA ---
    function openTrendModal(icon) {
        const { metric, current, prev, unit, account } = icon.dataset;
        
        const currentVal = parseFloat(current);
        const prevVal = parseFloat(prev);
        const diff = currentVal - prevVal;
        
        let diffPct = 0;
        if (prevVal !== 0) {
            diffPct = diff / prevVal;
        } else if (currentVal > 0) {
            diffPct = 1; 
        }
        
        const formatMap = {
            'Nota': (v) => formatDecimal(v),
            '% Efectividad': (v) => `${formatDecimal(v)}%`,
            'default': (v) => formatNumber(v) 
        };
        const formatter = formatMap[metric] || formatMap['default'];
        
        const prevWeek = WEEKS_ORDER[WEEKS_ORDER.indexOf(currentWeek) - 1];
        
        let diffHtml = '';
        if (unit === 'pp' || metric === 'Nota') {
            const diffSign = diff > 0 ? '+' : '';
            const diffClass = diff > 0 ? 'gain' : (diff < 0 ? 'loss' : 'neutral');
            const unitLabel = unit === 'pp' ? 'p.p.' : '';
            
            diffHtml = `
                <div class="trend-stat diff">
                    <span>Diferencia</span>
                    <span class="${diffClass}">${diffSign}${formatDecimal(diff)} ${unitLabel}</span>
                </div>
            `;
        } else {
            const diffSign = diff > 0 ? '+' : '';
            const diffClass = diff > 0 ? 'gain' : (diff < 0 ? 'loss' : 'neutral');
            const pctSign = diffPct > 0 ? '+' : '';
            const pctClass = diffPct > 0 ? 'gain' : (diffPct < 0 ? 'loss' : 'neutral');
            
            let finalDiffClass = diffClass;
            let finalPctClass = pctClass;
            if (metric === 'Likes Perdidos') {
                finalDiffClass = diff > 0 ? 'loss' : (diff < 0 ? 'gain' : 'neutral');
                finalPctClass = diffPct > 0 ? 'loss' : (diffPct < 0 ? 'gain' : 'neutral');
            }
            
            diffHtml = `
                <div class="trend-stat diff">
                    <span>Diferencia (Abs.)</span>
                    <span class="${finalDiffClass}">${diffSign}${formatter(diff)}</span>
                </div>
                <div class="trend-stat diff">
                    <span>Diferencia (%)</span>
                    <span class="${finalPctClass}">${pctSign}${diffPct.toLocaleString('es-CO', {style: 'percent', minimumFractionDigits: 1})}</span>
                </div>
            `;
        }

        trendModalTitle.textContent = `${metric} (${account})`;
        trendModalContent.innerHTML = `
            <div class="trend-stat">
                <span>${currentWeek} (Actual)</span>
                <span>${formatter(currentVal)}</span>
            </div>
            <div class="trend-stat">
                <span>${prevWeek} (Anterior)</span>
                <span>${formatter(prevVal)}</span>
            </div>
            ${diffHtml}
        `;
        
        trendModalOverlay.classList.add('visible');
        trendModal.classList.add('visible');
    }

    function closeTrendModal() {
        trendModalOverlay.classList.remove('visible');
        trendModal.classList.remove('visible');
    }
    // --- FIN LÓGICA MODAL TENDENCIA ---


    // --- EVENT LISTENERS ---
    function setupEventListeners() {
        themeToggle.addEventListener('click', () => applyTheme(document.body.dataset.theme === 'dark' ? 'light' : 'dark'));

        weekControls.addEventListener('click', (e) => {
            const weekBtn = e.target.closest('.week-btn');
            if (!weekBtn || weekBtn.classList.contains('active')) return;
            
            const week = weekBtn.dataset.week;
            handleWeekClick(week);
        });

        rankingList.addEventListener('click', (e) => {
            const header = e.target.closest('.category-header');
            if (header) {
                const wrapper = header.nextElementSibling;
                if (wrapper && wrapper.classList.contains('accounts-wrapper')) {
                    header.classList.toggle('collapsed');
                    wrapper.classList.toggle('collapsed');
                    header.setAttribute('aria-expanded', !header.classList.contains('collapsed'));
                }
                return;
            }

            const detailBtn = e.target.closest('.detail-btn');
            if (detailBtn) {
                const accountName = detailBtn.dataset.account;
                openDetailsModal(accountName);
                return;
            }
            
            const trendIcon = e.target.closest('.trend-icon');
            if (trendIcon) {
                openTrendModal(trendIcon);
                return;
            }
        });

        modalCloseBtn.addEventListener('click', closeModal);
        modalOverlay.addEventListener('click', closeModal);
        
        trendModalCloseBtn.addEventListener('click', closeTrendModal);
        trendModalOverlay.addEventListener('click', closeTrendModal);
    }
    
    function handleWeekClick(week) {
        showLoader(true);
        
        // Remove active class from all buttons and add to the clicked one
        weekControls.querySelectorAll('.week-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        const clickedButton = weekControls.querySelector(`.week-btn[data-week="${week}"]`);
        if (clickedButton) {
            clickedButton.classList.add('active');
        }
        
        currentWeek = week;
        
        const data = db.rankings[week];
        setTimeout(() => {
            renderRankingList(data, week);
            showLoader(false);
        }, 0);
    }
    
    function showLoader(show) { 
        loader.style.visibility = show ? 'visible' : 'hidden'; 
        loader.style.opacity = show ? '1' : '0'; 
    }

    // --- RUN APP ---
    main();
});