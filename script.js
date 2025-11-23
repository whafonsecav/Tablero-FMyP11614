document.addEventListener('DOMContentLoaded', () => {

    const SPREADSHEET_KEY = '1PTUUduAtN-YYAZYvGhg_pmkQUh2-qjNNkc-ZNyWbTOY';
    
    const WEEK_RANGES = {
        'Wk 44': 'B2:M',
        'Wk 45': 'O2:Z',
        'Wk 46': 'AB2:AM',
        'Wk 47': 'AO2:AZ',
        'Wk 48': 'BB2:BM'
    };
    const WEEKS_ORDER_TECHNICAL = ['Wk 44', 'Wk 45', 'Wk 46', 'Wk 47', 'Wk 48'];

    const CATEGORY_MAP = {
        'A': 'Categoría A - Nota: (4 a 5]',
        'B': 'Categoría B - Nota: (3 a 4]',
        'C': 'Categoría C - Nota: (2 a 3]',
        'D': 'Categoría D - Nota: (1 a 2]',
        'E': 'Categoría E - Nota: [0 a 1]'
    };
    const CATEGORIES_ORDER = ['A', 'B', 'C', 'D', 'E'];

    const loader = document.getElementById('loader');
    const themeToggle = document.getElementById('theme-toggle');
    const rankingList = document.getElementById('ranking-list');
    const weekControls = document.getElementById('week-controls');

    const modalOverlay = document.getElementById('modal-overlay');
    const detailsModal = document.getElementById('details-modal');
    const modalTitle = document.getElementById('modal-title');
    const modalCloseBtn = document.getElementById('modal-close-btn');
    const weekSelector = document.getElementById('week-selector');
    const modalTableContainer = document.getElementById('modal-table-container');
    
    const trendModalOverlay = document.getElementById('trend-modal-overlay');
    const trendModal = document.getElementById('trend-modal');
    const trendModalContent = document.getElementById('trend-modal-content');

    const db = { rankings: {} }; 
    const sheetCache = {}; 
    let currentWeek = ''; 
    let configMap = {}; 

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

    function applyTheme(theme) { 
        document.body.dataset.theme = theme; 
        localStorage.setItem('dashboard-theme', theme); 
    }
    
    async function main() {
        showLoader(true);
        applyTheme(localStorage.getItem('dashboard-theme') || 'light');
        try {
            await fetchConfig();
            const availableWeeks = await initializeRankings(); 
            setupEventListeners(); 
            
            if (availableWeeks.length > 0) {
                const lastWeek = availableWeeks[availableWeeks.length - 1];
                handleWeekClick(lastWeek); 
                
                setTimeout(() => {
                    initTutorial();
                }, 1500);
            } else {
                rankingList.innerHTML = '<p style="text-align: center; color: var(--text-secondary); margin-top: 2rem;">No hay reportes disponibles para mostrar.</p>';
                showLoader(false); 
            }
            
        } catch (error) {
            console.error("Dashboard Init Error:", error);
            alert("Error al cargar datos. Verifica la conexión y la publicación del Sheet.");
            showLoader(false);
        }
    }

    async function initTutorial() {
        document.body.classList.add('tutorial-mode');
        
        const driver = window.driver.js.driver;
        let driverObj = null;

        try {
            const firstDetailBtn = document.querySelector('.detail-btn');
            if (firstDetailBtn) {
                const accountName = firstDetailBtn.dataset.account;
                await fetchAccountData(accountName); 
            }
        } catch (e) {
            console.warn('No se pudo precargar el primer detalle para el tutorial:', e);
        }

        const openModalForTutorial = () => {
            if (!detailsModal.classList.contains('visible')) {
                const firstBtn = document.querySelector('.detail-btn');
                if(firstBtn) firstBtn.click();
            }
        };

        const closeModalForTutorial = () => {
            if (detailsModal.classList.contains('visible')) {
                closeModal();
            }
        };

        const openTrendModalForTutorial = () => {
            const trendIcon = document.querySelector('.trend-icon');
            if(trendIcon && !trendModal.classList.contains('visible')) {
                openTrendModal(trendIcon);
            }
        };

        const closeTrendModalForTutorial = () => {
            if(trendModal.classList.contains('visible')) {
                closeTrendModal();
            }
        };

        const tutorialSteps = [
            { 
                element: '.header-brand', 
                popover: { 
                    title: '¡Bienvenido al Tablero!', 
                    description: 'Este es tu centro de comando. Aquí podrás monitorear el desempeño y evolución de tu cuenta en el simulador de Instagram.' 
                },
                onHighlightStarted: () => { 
                    closeModalForTutorial(); 
                    closeTrendModalForTutorial(); 
                } 
            },
            { 
                element: '#week-controls', 
                popover: { 
                    title: 'Navega en el Tiempo', 
                    description: 'Usa estos botones para explorar los reportes de semanas anteriores y analizar tu evolución hasta la fecha más reciente.' 
                } 
            },
            { 
                element: '.category-header', 
                popover: { 
                    title: 'Clasificación de Cuentas', 
                    description: 'Aquí verás las cuentas agrupadas. Recuerda: estas categorías se definen por las reglas del simulador y dependen directamente de tu calificación.' 
                } 
            },
            { 
                element: '.ranking-item-card:first-child .stat-item.main-metric .trend-icon', 
                popover: { 
                    title: 'Indicadores de Tendencia', 
                    description: 'Estos íconos te muestran si tu métrica subió, bajó o se mantuvo vs. la semana anterior. Es un indicador visual rápido de tu rendimiento.' 
                },
                onHighlightStarted: () => { 
                    closeTrendModalForTutorial(); 
                }
            },
            {
                element: '#trend-modal-content',
                popover: { 
                    title: 'Análisis de Variación', 
                    description: 'Al detallar la tendencia, observarás los valores exactos y el cálculo matemático de la variación frente al periodo pasado. Entenderás cuánto creciste o decreciste exactamente.' 
                },
                onHighlightStarted: () => { 
                    openTrendModalForTutorial(); 
                }
            },
            { 
                element: '.detail-btn', 
                popover: { 
                    title: 'Análisis Profundo', 
                    description: 'Accede al historial completo: listado de contenidos, likes (reconocidos, reales y perdidos) y enlaces. Todo con comparaciones directas vs. la semana anterior.' 
                },
                onHighlightStarted: () => { 
                    closeTrendModalForTutorial(); 
                    closeModalForTutorial(); 
                } 
            },
            { 
                element: '#modal-stats-container', 
                popover: { 
                    title: 'Resumen de Impacto', 
                    description: 'Revisa el total del reporte, compáralo contra el periodo anterior y observa el porcentaje de cambio. Ideal para entender la variación de tus likes.' 
                },
                onHighlightStarted: () => { 
                    openModalForTutorial(); 
                }
            },
            { 
                element: '.modal-table-container thead', 
                popover: { 
                    title: 'Desglose de Datos', 
                    description: 'Aquí tienes el detalle granular: Fecha, Tipo de post, y el desglose de Likes (Reconocidos, Reales y Perdidos).' 
                },
                onHighlightStarted: () => { 
                    openModalForTutorial(); 
                }
            },
            { 
                element: '.modal-table-container th:nth-child(6)', 
                popover: { 
                    title: 'Evidencia y Estado', 
                    description: 'Aquí encontrarás el enlace "Ver", tu acceso directo a la publicación en Instagram. Si observas la etiqueta "No disp", indica que el contenido fue archivado o pertenece a un periodo posterior.' 
                }
            },
            { 
                element: '#theme-toggle', 
                popover: { 
                    title: 'Personalización', 
                    description: 'Cambia el modo visual (Claro/Oscuro) según tu preferencia visual.' 
                },
                onHighlightStarted: () => { 
                    closeModalForTutorial(); 
                } 
            }
        ];

        driverObj = driver({
            showProgress: true, 
            animate: true, 
            allowClose: true,
            nextBtnText: 'Siguiente', 
            doneBtnText: 'Finalizar',
            progressText: 'Paso {{current}} de {{total}}',
            steps: tutorialSteps,
            onDestroyed: () => {
                document.body.classList.remove('tutorial-mode'); 
            }
        });

        driverObj.drive();
    }

    async function fetchConfig() {
        const CONFIG_RANGE = 'BO2:BQ'; 
        const DATA_URL = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_KEY}/gviz/tq?tqx=out:csv&sheet=Ranking&range=${CONFIG_RANGE}`;

        try {
            const response = await fetch(DATA_URL);
            if (!response.ok) throw new Error('Failed to fetch config');
            const csvData = await response.text();
            const parsed = Papa.parse(csvData, { header: false, skipEmptyLines: true });
            let rows = parsed.data;
            if (rows.length > 0 && (rows[0][0] === 'Week' || rows[0][1] === 'Tag')) rows = rows.slice(1);

            rows.forEach(row => {
                const weekKey = row[0] ? row[0].trim() : null;
                if (weekKey) {
                    configMap[weekKey] = {
                        label: row[1] ? row[1].trim() : weekKey,
                        visible: row[2] ? row[2].trim().toLowerCase() === 'si' : false
                    };
                }
            });
        } catch (e) {
            WEEKS_ORDER_TECHNICAL.forEach(w => { 
                configMap[w] = { label: w, visible: true }; 
            });
        }
    }
    
    async function initializeRankings() {
        const availableWeeks = [];
        const fetchPromises = WEEKS_ORDER_TECHNICAL.map(week => {
            if (configMap[week] && !configMap[week].visible) {
                return Promise.resolve({ week: week, hasData: false, skipped: true });
            }
            const range = WEEK_RANGES[week];
            if (!range) return Promise.resolve({ week: week, hasData: false });
            return fetchRankingData(week, range);
        });

        const results = await Promise.allSettled(fetchPromises);
        results.forEach(result => {
            if (result.status === 'fulfilled' && result.value.hasData && !result.value.skipped) {
                availableWeeks.push(result.value.week);
            }
        });
        renderWeekControls(availableWeeks);
        return availableWeeks;
    }

    async function fetchRankingData(week, range) {
        const DATA_URL = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_KEY}/gviz/tq?tqx=out:csv&sheet=Ranking&range=${range}`;
        const response = await fetch(DATA_URL);
        if (!response.ok) throw new Error(`Failed to fetch sheet 'Ranking'`);
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
                error: (err) => { reject(err); }
            });
        });
    }
    
    function renderWeekControls(availableWeeks) {
        weekControls.innerHTML = ''; 
        if (availableWeeks.length === 0) return;
        availableWeeks.forEach(week => {
            const btn = document.createElement('button');
            btn.className = 'week-btn';
            btn.dataset.week = week; 
            btn.textContent = configMap[week] ? configMap[week].label : week;
            weekControls.appendChild(btn);
        });
    }
    
    function renderRankingList(data, week) {
        rankingList.innerHTML = ''; 
        if (!data || data.length === 0) {
             rankingList.innerHTML = '<p style="text-align: center; color: var(--text-secondary);">No se encontraron datos.</p>';
            return;
        }
        
        const weekIndex = WEEKS_ORDER_TECHNICAL.indexOf(week);
        let prevWeekData = null;
        if (weekIndex > 0) {
            for (let i = weekIndex - 1; i >= 0; i--) {
                const prevWk = WEEKS_ORDER_TECHNICAL[i];
                if (configMap[prevWk] && configMap[prevWk].visible && db.rankings[prevWk]) {
                     prevWeekData = new Map(db.rankings[prevWk].map(item => [item['Cuenta'], item]));
                     break;
                }
            }
        }

        CATEGORIES_ORDER.forEach(category => {
            const categoryHeader = document.createElement('button');
            categoryHeader.className = 'category-header';
            categoryHeader.innerHTML = `<span>${CATEGORY_MAP[category] || `Categoría ${category}`}</span><i class="fas fa-chevron-up"></i>`;
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
                    const accountName = item['Cuenta'];
                    const card = document.createElement('div');
                    card.className = `ranking-item-card card`;
                    card.dataset.account = accountName;
                    const prevItem = prevWeekData ? prevWeekData.get(accountName) : null;
                    
                    card.innerHTML = `
                        <div class="nota-badge ${failClass}" title="Nota">
                            ${formatDecimal(nota)}
                            ${createTrendIcon(item['Nota'], prevItem ? prevItem['Nota'] : null, 'Nota', 'number', accountName)}
                        </div>
                        <h3 class="account-name" title="${accountName}">
                            <a href="https://www.instagram.com/${accountName.trim()}/" target="_blank" rel="noopener noreferrer" style="color: inherit; text-decoration: none;">
                                ${accountName}
                            </a>
                        </h3>
                        <div class="stat-item main-metric">
                            <span class="stat-label">Likes Recon.</span>
                            <span class="stat-value">${formatNumber(item['Likes Reconocidos'])}</span>
                            ${createTrendIcon(item['Likes Reconocidos'], prevItem ? prevItem['Likes Reconocidos'] : null, 'Likes Reconocidos', 'number', accountName)}
                        </div>
                        <div class="stat-item">
                            <span class="stat-label"># Posts</span>
                            <span class="stat-value">${formatNumber(item['# Posts'])}</span>
                            ${createTrendIcon(item['# Posts'], prevItem ? prevItem['# Posts'] : null, '# Posts', 'number', accountName)}
                        </div>
                        <div class="separator"></div>
                        <div class="stat-item">
                            <span class="stat-label">Likes Reales</span>
                            <span class="stat-value">${formatNumber(item['Likes Reales'])}</span>
                            ${createTrendIcon(item['Likes Reales'], prevItem ? prevItem['Likes Reales'] : null, 'Likes Reales', 'number', accountName)}
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">% Efectividad</span>
                            <span class="stat-value gain">${item['% Efectividad']}</span>
                            ${createTrendIcon(cleanPercent(item['% Efectividad']), prevItem ? cleanPercent(prevItem['% Efectividad']) : null, '% Efectividad', 'pp', accountName)}
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Likes Perdidos</span>
                            <span class="stat-value loss">${formatNumber(item['Likes Perdidos'])}</span>
                            ${createTrendIcon(item['Likes Perdidos'], prevItem ? prevItem['Likes Perdidos'] : null, 'Likes Perdidos', 'number', accountName)}
                        </div>
                        <div class="separator"></div>
                        <div class="stat-item">
                            <span class="stat-label">Max Likes/Post</span>
                            <span class="stat-value">${formatNumber(item['Tope Maximo de likes'])}</span>
                            ${createTrendIcon(item['Tope Maximo de likes'], prevItem ? prevItem['Tope Maximo de likes'] : null, 'Max Likes/Post', 'number', accountName)}
                        </div>
                        <div class="symbol">=</div>
                        <div class="stat-item">
                            <span class="stat-label">Promedio Likes</span>
                            <span class="stat-value">${formatNumber(item['Promedio'])}</span>
                            ${createTrendIcon(item['Promedio'], prevItem ? prevItem['Promedio'] : null, 'Promedio Likes', 'number', accountName)}
                        </div>
                        <div class="symbol">+</div>
                        <div class="stat-item">
                            <span class="stat-label">Desv. Est. P</span>
                            <span class="stat-value">${formatNumber(item['Desviacion Estandar P'])}</span>
                            ${createTrendIcon(item['Desviacion Estandar P'], prevItem ? prevItem['Desviacion Estandar P'] : null, 'Desv. Est. P', 'number', accountName)}
                        </div>
                        <button class="detail-btn" data-account="${accountName}">Ver detalle</button>
                    `;
                    accountsWrapper.appendChild(card);
                });
            }
            rankingList.appendChild(categoryHeader);
            rankingList.appendChild(accountsWrapper);
        });
    }
    
    function createTrendIcon(currentVal, prevVal, metricName, unit, accountName) {
        if (prevVal === null || currentVal === null || typeof prevVal === 'undefined') return ''; 
        const diff = currentVal - prevVal;
        let iconClass = 'neutral fas fa-equals'; 
        if (diff > 0.01) iconClass = 'gain fas fa-arrow-up';
        if (diff < -0.01) iconClass = 'loss fas fa-arrow-down';
        if (metricName === 'Likes Perdidos') {
            if (diff > 0) iconClass = 'loss fas fa-arrow-up'; 
            if (diff < 0) iconClass = 'gain fas fa-arrow-down'; 
        }
        
        if (metricName.toLowerCase().includes('desv')) {
             iconClass = 'neutral fas fa-minus';
        }
        
        return `
            <span class="trend-icon ${iconClass.split(' ')[0]}" 
                  data-metric="${metricName}" 
                  data-current="${currentVal}" 
                  data-prev="${prevVal}" 
                  data-unit="${unit}" 
                  data-account="${accountName}">
                <i class="${iconClass.split(' ')[1]} ${iconClass.split(' ')[2]}"></i>
            </span>`;
    }

    function showModalLoader(show) {
        if (show) {
            modalTableContainer.innerHTML = '<div class="modal-loader"></div>';
            const statsContainer = document.getElementById('modal-stats-container');
            if (statsContainer) statsContainer.innerHTML = '';
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
        // Se cambió a innerHTML para permitir el enlace en el título del modal
        modalTitle.innerHTML = `Detalle: <a href="https://www.instagram.com/${accountName.trim()}/" target="_blank" rel="noopener noreferrer" style="color: inherit; text-decoration: none;">${accountName}</a>`;
        weekSelector.innerHTML = '';
        showModalLoader(true);
        try {
            const data = await fetchAccountData(accountName);
            buildModalContent(data);
        } catch (error) {
            modalTableContainer.innerHTML = `<p style="color: var(--loss-color); text-align: center;">Error al cargar hoja "${accountName}".</p>`;
        }
    }
    
    async function fetchAccountData(accountName) {
        if (sheetCache[accountName]) return sheetCache[accountName];
        const sheetUrl = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_KEY}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(accountName)}`;
        const response = await fetch(sheetUrl);
        if (!response.ok) throw new Error(`Sheet not found`);
        const csvData = await response.text();
        return new Promise((resolve, reject) => {
            Papa.parse(csvData, {
                header: true, 
                skipEmptyLines: true,
                complete: (result) => {
                    const data = result.data
                        .map(row => {
                            const cleanedRow = {};
                            for (const key in row) cleanedRow[key.trim()] = row[key];
                            return cleanedRow;
                        })
                        .filter(row => row.Fecha_Publicacion);
                    sheetCache[accountName] = data; 
                    resolve(data);
                }, 
                error: (err) => reject(err)
            });
        });
    }
    
    function buildModalContent(data) {
        weekSelector.innerHTML = '';
        const availableWeeks = WEEKS_ORDER_TECHNICAL.filter(wk => {
            if (configMap[wk] && !configMap[wk].visible) return false;
            const likesKey = `${wk} Likes`;
            if (!data[0] || !data[0].hasOwnProperty(likesKey)) return false;
            const sum = data.reduce((acc, row) => acc + cleanNumber(row[likesKey]), 0);
            return sum >= 0; 
        });

        if (availableWeeks.length === 0) {
            showModalLoader(false);
            modalTableContainer.innerHTML = `<p style="text-align: center;">No hay reportes visibles.</p>`;
            return;
        }

        availableWeeks.forEach(wk => {
            const btn = document.createElement('button');
            btn.className = 'week-btn'; 
            btn.dataset.week = wk;
            btn.textContent = configMap[wk] ? configMap[wk].label : wk;
            btn.addEventListener('click', () => {
                weekSelector.querySelectorAll('.week-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                renderModalTable(data, wk);
                renderWeekStats(data, wk, availableWeeks);
            });
            weekSelector.appendChild(btn);
        });
        const defaultButton = weekSelector.querySelector(`button[data-week="${currentWeek}"]`);
        if (defaultButton) defaultButton.click(); 
        else if (weekSelector.lastChild) weekSelector.lastChild.click(); 
    }
    
    function renderWeekStats(data, selectedWeek, availableWeeks) {
        const statsContainer = document.getElementById('modal-stats-container');
        statsContainer.innerHTML = '';
        const weekIndex = availableWeeks.indexOf(selectedWeek);
        const currentTotal = calculateWeekTotal(data, selectedWeek, 'Likes Reconocidos');
        const weekLabel = configMap[selectedWeek] ? configMap[selectedWeek].label : selectedWeek;
        
        let html = `
            <div class="modal-stat-card">
                <p>Total ${weekLabel}</p>
                <div class="stat-value">${formatNumber(currentTotal)}</div>
            </div>`;
        
        let prevWeekWasAvailable = false; 
        let previousTotal = 0;
        let prevWeekLabel = '';
        if (weekIndex > 0) {
            const previousWeek = availableWeeks[weekIndex - 1];
            prevWeekLabel = configMap[previousWeek] ? configMap[previousWeek].label : previousWeek;
            prevWeekWasAvailable = true;
            previousTotal = calculateWeekTotal(data, previousWeek, 'Likes Reconocidos');
        }

        if (prevWeekWasAvailable) {
            const diffQty = currentTotal - previousTotal;
            const diffPct = (previousTotal === 0) ? (currentTotal > 0 ? 1 : 0) : (diffQty / previousTotal);
            const qtyClass = diffQty > 0 ? 'gain' : (diffQty < 0 ? 'loss' : '');
            html += `
                <div class="modal-stat-card">
                    <p>vs. ${prevWeekLabel}</p>
                    <div class="stat-value ${qtyClass}">
                        ${diffQty > 0 ? '+' : ''}${formatNumber(diffQty)}
                    </div>
                </div>
                <div class="modal-stat-card">
                    <p>Cambio %</p>
                    <div class="stat-value ${qtyClass}">
                        ${diffPct > 0 ? '+' : ''}${diffPct.toLocaleString('es-CO', {style: 'percent', minimumFractionDigits: 1})}
                    </div>
                </div>`;
        } else {
            html += `
                <div class="modal-stat-card">
                    <p>vs. Anterior</p>
                    <div class="stat-value">-</div>
                </div>
                <div class="modal-stat-card">
                    <p>Cambio %</p>
                    <div class="stat-value">-</div>
                </div>`;
        }
        statsContainer.innerHTML = html;
    }

    function renderModalTable(data, week) {
        showModalLoader(false);
        const likesRecKey = `${week} Likes Reconocidos`;
        const likesKey = `${week} Likes`; 
        const likesPerdidosKey = `${week} Likes Perdidos`;
        
        const table = document.createElement('table');
        table.innerHTML = `
            <thead>
                <tr>
                    <th>Fecha</th>
                    <th>Tipo</th>
                    <th>Likes Recon.</th>
                    <th>Likes Reales</th>
                    <th>Perdidos</th>
                    <th>Enlace</th>
                </tr>
            </thead>
            <tbody></tbody>`;
        const tbody = table.querySelector('tbody');
        let hasRows = false;
        data.forEach(row => {
            if (!row['Fecha_Publicacion']) return;
            hasRows = true;
            const tr = document.createElement('tr');
            const likesPerdidosValue = cleanNumber(row[likesPerdidosKey]);
            const rawRealLikes = row[likesKey];
            let linkHtml = (!rawRealLikes || rawRealLikes === '') 
                ? `<span class="disabled-link">No disp.</span>` 
                : `<a href="${row['Enlace'] || '#'}" target="_blank" rel="noopener noreferrer">Ver</a>`;

            tr.innerHTML = `
                <td>${row['Fecha_Publicacion'] || ''}</td>
                <td>${row['Tipo_Post'] || ''}</td>
                <td>${formatNumber(cleanNumber(row[likesRecKey]))}</td>
                <td>${formatNumber(cleanNumber(row[likesKey]))}</td>
                <td class="${likesPerdidosValue !== 0 ? 'loss' : ''}">
                    ${formatNumber(likesPerdidosValue)}
                </td>
                <td>${linkHtml}</td>`;
            tbody.appendChild(tr);
        });
        if (!hasRows) {
            modalTableContainer.innerHTML = `<p style="padding:1rem; text-align:center;">No hay publicaciones.</p>`;
        } else { 
            modalTableContainer.innerHTML = ''; 
            modalTableContainer.appendChild(table);
            setTimeout(() => {
                modalTableContainer.scrollTop = modalTableContainer.scrollHeight;
            }, 50);
        }
    }
    
    function openTrendModal(icon) {
        const { metric, current, prev, unit, account } = icon.dataset;
        const currentVal = parseFloat(current);
        const prevVal = parseFloat(prev);
        const diff = currentVal - prevVal;
        
        let relativePct = 0;
        if (prevVal !== 0) relativePct = (diff / prevVal);
        else if (currentVal > 0) relativePct = 1;

        const formatDecimalLocal = (v) => v.toLocaleString('es-CO', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
        const formatNumberLocal = (v) => v.toLocaleString('es-CO', { maximumFractionDigits: 0 });
        const formatPercentLocal = (v) => v.toLocaleString('es-CO', { style: 'percent', maximumFractionDigits: 1 });

        let displayDiff = '';
        let displaySubDiff = '';
        let valueFormatter = formatNumberLocal;
        let isPositiveGood = true;

        if (metric === 'Nota') {
            valueFormatter = formatDecimalLocal;
            displayDiff = `${diff > 0 ? '+' : ''}${formatDecimalLocal(diff)} Puntos`;
            displaySubDiff = 'Variación en Calificación';
        } else if (metric === '% Efectividad') {
            valueFormatter = (v) => `${formatDecimalLocal(v)}%`;
            displayDiff = `${diff > 0 ? '+' : ''}${formatDecimalLocal(diff)} p.p.`;
            displaySubDiff = 'Puntos Porcentuales';
        } else {
            valueFormatter = formatNumberLocal;
            displayDiff = `${diff > 0 ? '+' : ''}${formatNumberLocal(diff)}`;
            displaySubDiff = formatPercentLocal(relativePct);
            if (metric === 'Likes Perdidos') isPositiveGood = false; 
        }

        let statusClass = 'neutral';
        let iconClass = 'fa-minus';
        
        if (metric.toLowerCase().includes('desv')) {
            statusClass = 'neutral';
            iconClass = 'fa-minus'; 
        } 
        else if (Math.abs(diff) > 0.001) {
            if (diff > 0) {
                statusClass = isPositiveGood ? 'gain' : 'loss';
                iconClass = isPositiveGood ? 'fa-arrow-trend-up' : 'fa-arrow-trend-down'; 
            } else {
                statusClass = isPositiveGood ? 'loss' : 'gain';
                iconClass = isPositiveGood ? 'fa-arrow-trend-down' : 'fa-arrow-trend-up';
            }
        }

        const currentWeekIndex = WEEKS_ORDER_TECHNICAL.indexOf(currentWeek);
        let prevWeekLabel = 'Anterior';
        for (let i = currentWeekIndex - 1; i >= 0; i--) {
            const w = WEEKS_ORDER_TECHNICAL[i];
             if (configMap[w] && configMap[w].visible) { 
                prevWeekLabel = configMap[w].label; 
                break; 
            }
        }
        const currentWeekLabel = configMap[currentWeek] ? configMap[currentWeek].label : currentWeek;

        const htmlContent = `
            <div class="trend-card-container">
                <div class="trend-header-hero ${statusClass}">
                    <button class="trend-close-absolute" id="trend-modal-custom-close">&times;</button>
                    <i class="fas ${iconClass} trend-hero-icon"></i>
                    <div class="trend-metric-title">${metric}</div>
                    <div class="trend-main-diff">${displayDiff}</div>
                    <div class="trend-sub-diff">${displaySubDiff}</div>
                    <div style="margin-top:0.5rem; font-size:0.8rem; opacity:0.9">
                        <a href="https://www.instagram.com/${account.trim()}/" target="_blank" rel="noopener noreferrer" style="color: inherit; text-decoration: none; border-bottom: 1px dotted rgba(255,255,255,0.5);">
                            ${account}
                        </a>
                    </div>
                </div>
                <div class="trend-body-comparison">
                    <div class="comp-box">
                        <span class="comp-label">${prevWeekLabel}</span>
                        <span class="comp-value">${valueFormatter(prevVal)}</span>
                    </div>
                    <div class="comp-vs">VS</div>
                    <div class="comp-box">
                        <span class="comp-label">${currentWeekLabel}</span>
                        <span class="comp-value">${valueFormatter(currentVal)}</span>
                    </div>
                </div>
            </div>`;

        trendModalContent.innerHTML = htmlContent;
        document.getElementById('trend-modal-custom-close').addEventListener('click', closeTrendModal);
        trendModalOverlay.classList.add('visible');
        trendModal.classList.add('visible');
    }

    function closeTrendModal() {
        trendModalOverlay.classList.remove('visible');
        trendModal.classList.remove('visible');
    }

    function setupEventListeners() {
        themeToggle.addEventListener('click', () => 
            applyTheme(document.body.dataset.theme === 'dark' ? 'light' : 'dark')
        );
        weekControls.addEventListener('click', (e) => {
            const weekBtn = e.target.closest('.week-btn');
            if (!weekBtn || weekBtn.classList.contains('active')) return;
            handleWeekClick(weekBtn.dataset.week);
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
            if (e.target.closest('.detail-btn')) { 
                openDetailsModal(e.target.closest('.detail-btn').dataset.account); 
                return; 
            }
            if (e.target.closest('.trend-icon')) { 
                openTrendModal(e.target.closest('.trend-icon')); 
                return; 
            }
        });
        modalCloseBtn.addEventListener('click', closeModal);
        modalOverlay.addEventListener('click', closeModal);
        trendModalOverlay.addEventListener('click', closeTrendModal);
    }
    
    function handleWeekClick(week) {
        showLoader(true);
        weekControls.querySelectorAll('.week-btn').forEach(btn => btn.classList.remove('active'));
        const clickedButton = weekControls.querySelector(`.week-btn[data-week="${week}"]`);
        if (clickedButton) clickedButton.classList.add('active');
        currentWeek = week;
        const data = db.rankings[week];
        setTimeout(() => { 
            renderRankingList(data, week); 
            showLoader(false); 
        }, 100); 
    }
    
    function showLoader(show) { 
        loader.style.visibility = show ? 'visible' : 'hidden'; 
        loader.style.opacity = show ? '1' : '0'; 
    }

    main();
});
