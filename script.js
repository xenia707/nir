// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    // Установка даты обновления
    document.getElementById('update-date').textContent = new Date().toLocaleString();
    
    // Инициализация карты с увеличенной сеткой 120x120
    initMap(120, 120);
    
    // Инициализация мини-карты
    initMiniMap();
    
    // Назначение обработчиков событий
    document.getElementById('calculate-btn').addEventListener('click', calculateFWI);
    document.getElementById('reset-btn').addEventListener('click', resetMap);
    document.getElementById('simulate-btn').addEventListener('click', startSimulation);
    document.getElementById('analyze-ndvi-btn').addEventListener('click', analyzeNDVI);
    document.getElementById('ndvi-upload').addEventListener('change', handleNDVIUpload);
    
    // Инициализация ручного редактирования
    setTimeout(enableManualSurfaceEditing, 1000);
    
    // Добавляем кнопку для создания тестовой карты
    addTestNDVIButton();
});

// Матрица вероятностей распространения
const spreadProbabilities = {
    'water': 0,      // Полный барьер
    'sand': 0,       // Полный барьер  
    'forest': 0.9,   // Высокая скорость
    'soil': 0.3,     // Средняя скорость
    'farmland': 0.2, // Низкая скорость
    'unknown': 0.5   // По умолчанию
};

// Карта соответствия типов поверхности уровням опасности
const surfaceToDangerLevel = {
    'water': 'low',
    'sand': 'low', 
    'forest': 'high',
    'soil': 'medium',
    'farmland': 'medium',
    'unknown': 'medium'
};

// Инициализация основной карты
function initMap(rows = 120, cols = 120) {
    const mapGrid = document.getElementById('map-grid');
    mapGrid.innerHTML = '';
    
    // Устанавливаем размеры сетки
    mapGrid.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
    mapGrid.style.gridTemplateRows = `repeat(${rows}, 1fr)`;
    
    // Создаем клетки
    for (let i = 0; i < rows * cols; i++) {
        const cell = document.createElement('div');
        cell.className = 'map-cell unknown';
        cell.dataset.index = i;
        cell.dataset.surfaceType = 'unknown';
        
        // Добавляем обработчики событий
        cell.addEventListener('click', function(e) {
            handleMapCellClick(this, e);
        });
        
        cell.addEventListener('mouseenter', function() {
            updateMapOverlay(this);
        });
        
        mapGrid.appendChild(cell);
    }
}

// Обработчик клика по клетке карты
function handleMapCellClick(cell, event) {
    if (event.shiftKey && window.currentSurfaceType) {
        // Shift+клик - изменение типа поверхности
        updateCellSurface(cell, window.currentSurfaceType);
    } else {
        // Обычный клик - переключение пожара
        toggleFireOnCell(cell);
    }
}

// Обновление информации в оверлее
function updateMapOverlay(cell) {
    const overlay = document.querySelector('.map-overlay');
    const index = parseInt(cell.dataset.index);
    const cols = 120;
    const x = index % cols;
    const y = Math.floor(index / cols);
    const surfaceType = cell.dataset.surfaceType;
    
    const surfaceNames = {
        'water': 'Вода',
        'forest': 'Лес',
        'sand': 'Песок',
        'soil': 'Почва',
        'farmland': 'Сельхозземли',
        'unknown': 'Неизвестно'
    };
    
    overlay.innerHTML = `
        <div>Координаты: X: ${x}, Y: ${y}</div>
        <div>Поверхность: ${surfaceNames[surfaceType]}</div>
        <div>Опасность: ${getDangerLevelText(cell)}</div>
    `;
}

// Получение текстового описания уровня опасности
function getDangerLevelText(cell) {
    if (cell.classList.contains('low')) return 'Низкая';
    if (cell.classList.contains('medium')) return 'Средняя';
    if (cell.classList.contains('high')) return 'Высокая';
    if (cell.classList.contains('extreme')) return 'Чрезвычайная';
    return 'Не определена';
}

// Инициализация мини-карты
function initMiniMap() {
    const miniMap = document.getElementById('mini-map');
    miniMap.innerHTML = '';
    
    // Создаем 10x10 клеток для мини-карты
    for (let i = 0; i < 100; i++) {
        const cell = document.createElement('div');
        cell.className = 'mini-cell';
        miniMap.appendChild(cell);
    }
}

// Обработка загрузки NDVI карты
function handleNDVIUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        console.log('NDVI карта загружена, готово к анализу');
    };
    reader.readAsDataURL(file);
}

// Анализ NDVI карты
function analyzeNDVI() {
    const fileInput = document.getElementById('ndvi-upload');
    const file = fileInput.files[0];
    
    if (!file) {
        alert('Пожалуйста, загрузите NDVI карту');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
        const img = new Image();
        img.onload = function() {
            processNDVIImage(img);
        };
        img.onerror = function() {
            alert('Ошибка загрузки изображения');
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

// Функция классификации цвета NDVI
function classifyNDVIColor(r, g, b) {
    // Нормализуем цвета
    const total = r + g + b;
    if (total === 0) return 'unknown';
    
    const rNorm = r / total;
    const gNorm = g / total;
    const bNorm = b / total;
    
    // Синий - вода (барьер) - синий преобладает
    if (b > r + 50 && b > g + 50 && b > 150) return 'water';
    
    // Зеленый - лес (высокая горючесть) - зеленый преобладает
    if (g > r + 30 && g > b + 30 && g > 120) return 'forest';
    
    // Желтый - песок (барьер) - красный и зеленый высокие, синий низкий
    if (r > 180 && g > 160 && b < 100 && Math.abs(r - g) < 60) return 'sand';
    
    // Красный - открытая почва (средняя горючесть) - красный преобладает
    if (r > g + 50 && r > b + 50 && r > 150) return 'soil';
    
    // Бирюзовый - сельхозземли - зеленый и синий высокие
    if (g > 120 && b > 120 && r < g - 30 && r < b - 30) return 'farmland';
    
    return 'unknown';
}

// Обработка NDVI изображения
function processNDVIImage(img) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    // Устанавливаем размеры canvas под размер сетки 120x120
    const cols = 120;
    const rows = 120;
    
    canvas.width = cols;
    canvas.height = rows;

    try {
        // Вычисляем соотношения сторон
        const imgRatio = img.width / img.height;
        const canvasRatio = cols / rows;
        
        let sourceWidth, sourceHeight, sourceX, sourceY;
        
        if (imgRatio > canvasRatio) {
            // Изображение шире - обрезаем по бокам
            sourceHeight = img.height;
            sourceWidth = img.height * canvasRatio;
            sourceX = (img.width - sourceWidth) / 2;
            sourceY = 0;
        } else {
            // Изображение выше - обрезаем сверху и снизу
            sourceWidth = img.width;
            sourceHeight = img.width / canvasRatio;
            sourceX = 0;
            sourceY = (img.height - sourceHeight) / 2;
        }
        
        // Рисуем изображение с обрезкой и масштабированием
        ctx.drawImage(img, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, cols, rows);
        
        // Анализируем пиксели
        const imageData = ctx.getImageData(0, 0, cols, rows);
        const data = imageData.data;
        
        const mapCells = document.querySelectorAll('.map-cell');
        
        let classifiedCount = 0;
        const typeCount = { water: 0, forest: 0, sand: 0, soil: 0, farmland: 0, unknown: 0 };
        
        // Обрабатываем каждый пиксель
        for (let y = 0; y < rows; y++) {
            for (let x = 0; x < cols; x++) {
                const pixelIndex = (y * cols + x);
                const dataIndex = pixelIndex * 4;
                
                const r = data[dataIndex];
                const g = data[dataIndex + 1];
                const b = data[dataIndex + 2];
                
                // Классифицируем цвет
                const surfaceType = classifyNDVIColor(r, g, b);
                
                // Обновляем соответствующую клетку
                if (mapCells[pixelIndex]) {
                    updateCellSurface(mapCells[pixelIndex], surfaceType);
                    typeCount[surfaceType]++;
                    classifiedCount++;
                }
            }
        }
        
        // Показываем статистику
        const stats = Object.entries(typeCount)
            .filter(([type, count]) => count > 0)
            .map(([type, count]) => `${type}: ${count}`)
            .join(', ');
        
        alert(`NDVI анализ завершен!\nКлассифицировано: ${classifiedCount} клеток\nРаспределение: ${stats}`);
        
    } catch (error) {
        console.error('Ошибка обработки изображения:', error);
        alert('Ошибка обработки изображения. Попробуйте другое изображение.');
    }
}

// Обновление типа поверхности клетки
function updateCellSurface(cell, surfaceType) {
    // Удаляем старые классы поверхностей
    cell.classList.remove('water', 'forest', 'sand', 'soil', 'farmland', 'unknown');
    
    // Добавляем новый класс
    cell.classList.add(surfaceType);
    cell.dataset.surfaceType = surfaceType;
    
    // Обновляем уровень опасности на основе типа поверхности
    updateCellDangerLevel(cell, surfaceToDangerLevel[surfaceType]);
}

// Обновление уровня опасности клетки
function updateCellDangerLevel(cell, dangerLevel) {
    // Удаляем старые классы опасности
    cell.classList.remove('low', 'medium', 'high', 'extreme');
    
    // Добавляем новый класс опасности
    cell.classList.add(dangerLevel);
}

// Переключение пожара на клетке
function toggleFireOnCell(cell) {
    const surfaceType = cell.dataset.surfaceType;
    
    // Проверяем, можно ли поджечь эту поверхность
    if (surfaceType === 'water' || surfaceType === 'sand') {
        alert('Эту поверхность нельзя поджечь (барьер)');
        return;
    }
    
    if (!cell.classList.contains('fire')) {
        cell.classList.add('fire');
    } else {
        cell.classList.remove('fire');
    }
}

// Расчет индекса пожарной опасности
function calculateFWI() {
    const temperature = parseFloat(document.getElementById('temperature').value) || 0;
    const humidity = parseFloat(document.getElementById('humidity').value) || 0;
    const windSpeed = parseFloat(document.getElementById('wind-speed').value) || 0;
    const precipitation = parseFloat(document.getElementById('precipitation').value) || 0;
    
    // Упрощенный расчет FWI
    let fwi = (temperature * 0.5) + ((100 - humidity) * 0.3) + (windSpeed * 0.15) - (precipitation * 2);
    fwi = Math.max(0, fwi); // FWI не может быть отрицательным
    
    // Обновляем виджет результатов
    const resultsWidget = document.getElementById('results-widget');
    resultsWidget.innerHTML = `
        <div class="results-active">
            <h3>Расчёт выполнен</h3>
            <p>Индекс FWI: <strong>${fwi.toFixed(2)}</strong></p>
            <p>Уровень опасности: <strong>${getDangerLevel(fwi)}</strong></p>
            <p>Рекомендация: <strong>${getRecommendation(fwi)}</strong></p>
        </div>
        <div class="mini-map" id="mini-map"></div>
    `;
    
    // Переинициализируем мини-карту
    initMiniMap();
    
    // Запускаем симуляцию на мини-карте
    simulateFireSpread();
}

// Определение уровня опасности по FWI
function getDangerLevel(fwi) {
    if (fwi < 5) return 'Низкий';
    if (fwi < 15) return 'Умеренный';
    if (fwi < 30) return 'Высокий';
    if (fwi < 50) return 'Очень высокий';
    return 'Экстремальный';
}

// Получение рекомендации по уровню опасности
function getRecommendation(fwi) {
    if (fwi < 5) return 'Опасность минимальна';
    if (fwi < 15) return 'Соблюдайте осторожность';
    if (fwi < 30) return 'Ограничьте посещение леса';
    if (fwi < 50) return 'Высокий риск возгорания';
    return 'Критическая ситуация, возможны крупные пожары';
}

// Симуляция распространения пожара на мини-карте
function simulateFireSpread() {
    const miniCells = document.querySelectorAll('#mini-map .mini-cell');
    
    // Очищаем мини-карту
    miniCells.forEach(cell => {
        cell.classList.remove('fire');
    });
    
    // Устанавливаем начальный очаг пожара в центре
    const centerIndex = 45; // Примерно центр для 10x10 сетки
    miniCells[centerIndex].classList.add('fire');
    
    // Распространяем пожар с задержками для анимации
    setTimeout(() => spreadFire(miniCells, centerIndex - 1), 300);
    setTimeout(() => spreadFire(miniCells, centerIndex + 1), 500);
    setTimeout(() => spreadFire(miniCells, centerIndex - 10), 700);
    setTimeout(() => spreadFire(miniCells, centerIndex + 10), 900);
    setTimeout(() => spreadFire(miniCells, centerIndex - 11), 1100);
    setTimeout(() => spreadFire(miniCells, centerIndex - 9), 1300);
    setTimeout(() => spreadFire(miniCells, centerIndex + 9), 1500);
    setTimeout(() => spreadFire(miniCells, centerIndex + 11), 1700);
}

// Распространение пожара на соседние клетки мини-карты
function spreadFire(cells, index) {
    if (index >= 0 && index < cells.length) {
        cells[index].classList.add('fire');
    }
}

// Сброс карты
function resetMap() {
    initMap(120, 120);
    
    // Сбрасываем результаты
    const resultsWidget = document.getElementById('results-widget');
    resultsWidget.innerHTML = `
        <div class="results-placeholder">
            <p>Расчёт не выполнен</p>
            <p>Введите данные и нажмите "Рассчитать"</p>
        </div>
        <div class="mini-map" id="mini-map"></div>
    `;
    
    initMiniMap();
    
    // Сбрасываем загрузку файла
    document.getElementById('ndvi-upload').value = '';
}

// Запуск симуляции на основной карте
function startSimulation() {
    const mapCells = document.querySelectorAll('.map-cell');
    const fireCells = [];
    
    // Находим все клетки с пожаром
    mapCells.forEach((cell, index) => {
        if (cell.classList.contains('fire')) {
            fireCells.push(index);
        }
    });
    
    if (fireCells.length === 0) {
        alert('Нет активных пожаров для симуляции. Нажмите на карту, чтобы создать очаги пожара.');
        return;
    }
    
    // Распространяем пожар от каждой горящей клетки
    fireCells.forEach(index => {
        spreadToNeighbors(mapCells, index);
    });
    
    alert('Симуляция запущена! Пожар будет распространяться с учетом типов поверхности и ветра.');
}

// Модифицированная функция распространения пожара
function spreadToNeighbors(cells, index) {
    const cols = 120;
    const rows = 120;
    
    const windDirection = parseInt(document.getElementById('wind-direction').value) || 0;
    const windEffect = parseFloat(document.getElementById('wind-effect').value) || 1.0;
    
    // Определяем индексы соседей (8-связность)
    const neighbors = [
        {index: index - cols, dx: 0, dy: -1},    // сверху
        {index: index + cols, dx: 0, dy: 1},     // снизу
        {index: index - 1, dx: -1, dy: 0},       // слева
        {index: index + 1, dx: 1, dy: 0},        // справа
        {index: index - cols - 1, dx: -1, dy: -1}, // сверху-слева
        {index: index - cols + 1, dx: 1, dy: -1},  // сверху-справа
        {index: index + cols - 1, dx: -1, dy: 1},  // снизу-слева
        {index: index + cols + 1, dx: 1, dy: 1}    // снизу-справа
    ];
    
    neighbors.forEach(neighbor => {
        // Проверяем, что сосед существует и не выходит за границы
        if (neighbor.index >= 0 && neighbor.index < cells.length && 
            Math.abs((neighbor.index % cols) - (index % cols)) <= 1) {
            
            const neighborCell = cells[neighbor.index];
            const surfaceType = neighborCell.dataset.surfaceType;
            
            // Пропускаем барьеры
            if (surfaceType === 'water' || surfaceType === 'sand') {
                return;
            }
            
            // Базовая вероятность распространения
            let probability = spreadProbabilities[surfaceType] || 0.5;
            
            // Учет направления ветра
            probability = applyWindEffect(probability, neighbor.dx, neighbor.dy, windDirection, windEffect);
            
            // Поджигаем соседа с учетом вероятности
            if (!neighborCell.classList.contains('fire') && Math.random() < probability) {
                setTimeout(() => {
                    neighborCell.classList.add('fire');
                    
                    // Рекурсивно распространяем пожар
                    setTimeout(() => {
                        spreadToNeighbors(cells, neighbor.index);
                    }, 300 + Math.random() * 500);
                }, Math.random() * 400);
            }
        }
    });
}

// Применение эффекта ветра
function applyWindEffect(baseProbability, dx, dy, windDirection, windEffect) {
    // Преобразуем направление ветра в радианы
    const windRad = windDirection * Math.PI / 180;
    
    // Вычисляем направление к соседу
    const directionRad = Math.atan2(dy, dx);
    
    // Вычисляем разницу углов
    let angleDiff = Math.abs(windRad - directionRad);
    angleDiff = Math.min(angleDiff, 2 * Math.PI - angleDiff);
    
    // Коэффициент влияния ветра
    let windFactor = 1.0;
    
    if (angleDiff < Math.PI / 4) {
        // Попутный ветер - усиление
        windFactor = windEffect;
    } else if (angleDiff > 3 * Math.PI / 4) {
        // Встречный ветер - ослабление
        windFactor = 1.0 / windEffect;
    }
    
    return Math.min(0.95, baseProbability * windFactor);
}

// Включение ручного редактирования типов поверхности
function enableManualSurfaceEditing() {
    const mapCells = document.querySelectorAll('.map-cell');
    
    // Создаем панель выбора типа поверхности
    const surfacePanel = document.createElement('div');
    surfacePanel.className = 'surface-panel';
    surfacePanel.innerHTML = `
        <h3>Ручная корректировка (Shift+клик)</h3>
        <div class="surface-options">
            <button data-type="water">Вода</button>
            <button data-type="forest">Лес</button>
            <button data-type="sand">Песок</button>
            <button data-type="soil">Почва</button>
            <button data-type="farmland">Сельхоз</button>
            <button data-type="unknown">Неизвестно</button>
        </div>
        <div style="margin-top: 0.5rem; font-size: 0.8rem; color: var(--text-muted);">
            Зажмите Shift и кликните по карте для изменения типа поверхности
        </div>
    `;
    
    document.querySelector('.control-panel').appendChild(surfacePanel);
    
    // Устанавливаем тип поверхности по умолчанию
    window.currentSurfaceType = 'forest';
    
    // Обработчики для кнопок выбора поверхности
    surfacePanel.querySelectorAll('button').forEach(button => {
        button.addEventListener('click', function() {
            window.currentSurfaceType = this.dataset.type;
            
            // Визуальная обратная связь
            surfacePanel.querySelectorAll('button').forEach(btn => {
                btn.style.backgroundColor = '';
                btn.style.borderColor = '';
            });
            this.style.backgroundColor = 'rgba(45, 140, 255, 0.2)';
            this.style.borderColor = 'var(--accent-blue)';
        });
    });
    
    // Выбираем первую кнопку по умолчанию
    surfacePanel.querySelector('button[data-type="forest"]').click();
}

// Функция для создания тестовой NDVI карты
function createTestNDVI() {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const cols = 120;
    const rows = 120;
    
    canvas.width = cols;
    canvas.height = rows;

    // Создаем шум Перлина для естественных форм
    function noise(x, y) {
        return Math.sin(x * 0.05) * Math.cos(y * 0.05) + 
               Math.sin(x * 0.025 + y * 0.015) * 0.5 +
               Math.sin(x * 0.01) * Math.cos(y * 0.02) * 0.3;
    }

    // Функция для проверки принадлежности к эллипсу
    function inEllipse(x, y, centerX, centerY, radiusX, radiusY, angle) {
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const dx = x - centerX;
        const dy = y - centerY;
        const rotatedX = dx * cos + dy * sin;
        const rotatedY = -dx * sin + dy * cos;
        return (rotatedX * rotatedX) / (radiusX * radiusX) + 
               (rotatedY * rotatedY) / (radiusY * radiusY) <= 1;
    }

    // Создаем различные зоны с естественными формами
    const zones = [
        { type: 'water', centerX: 20, centerY: 20, radiusX: 15, radiusY: 12, angle: 0.3 },
        { type: 'water', centerX: 100, centerY: 15, radiusX: 10, radiusY: 8, angle: -0.2 },
        { type: 'sand', centerX: 110, centerY: 30, radiusX: 25, radiusY: 15, angle: 0.5 },
        { type: 'forest', centerX: 60, centerY: 60, radiusX: 40, radiusY: 30, angle: 0.1 },
        { type: 'forest', centerX: 30, centerY: 80, radiusX: 20, radiusY: 25, angle: -0.4 },
        { type: 'soil', centerX: 90, centerY: 90, radiusX: 30, radiusY: 20, angle: 0.2 },
        { type: 'farmland', centerX: 50, centerY: 110, radiusX: 15, radiusY: 12, angle: 0.6 }
    ];

    // Создаем реки (линейные зоны)
    function inRiver(x, y) {
        // Река 1 - диагональная
        const river1 = Math.abs((x - y * 0.7) - 40) < 3 + noise(x, y) * 2;
        // Река 2 - горизонтальная с изгибом
        const river2 = Math.abs(y - 50 - Math.sin(x * 0.05) * 10) < 2 + noise(x, y);
        return river1 || river2;
    }

    // Создаем дороги (песчаные полосы)
    function inRoad(x, y) {
        const road1 = Math.abs(x - 80) < 2 + noise(x, y) * 1;
        const road2 = Math.abs(y - 70 - Math.cos(x * 0.04) * 6) < 1.5 + noise(x, y) * 1;
        return road1 || road2;
    }

    for (let x = 0; x < cols; x++) {
        for (let y = 0; y < rows; y++) {
            let surfaceType = 'unknown';
            let foundInZone = false;

            // Проверяем реки (преимущество)
            if (inRiver(x, y)) {
                surfaceType = 'water';
                foundInZone = true;
            }
            // Проверяем дороги
            else if (inRoad(x, y)) {
                surfaceType = 'sand';
                foundInZone = true;
            }
            // Проверяем основные зоны
            else {
                for (const zone of zones) {
                    if (inEllipse(x, y, zone.centerX, zone.centerY, 
                                 zone.radiusX + noise(x, y) * 5, 
                                 zone.radiusY + noise(x, y) * 5, 
                                 zone.angle)) {
                        surfaceType = zone.type;
                        foundInZone = true;
                        break;
                    }
                }
            }

            // Если не в зоне, создаем естественный ландшафт на основе шума
            if (!foundInZone) {
                const n = noise(x, y);
                if (n > 0.3) {
                    surfaceType = 'forest';
                } else if (n > -0.2) {
                    surfaceType = 'soil';
                } else if (n > -0.5) {
                    surfaceType = 'farmland';
                } else {
                    surfaceType = 'sand';
                }
            }

            // Устанавливаем цвет в зависимости от типа поверхности
            let r, g, b;
            switch (surfaceType) {
                case 'water':
                    r = 0 + Math.random() * 30;
                    g = 100 + Math.random() * 40;
                    b = 200 + Math.random() * 55;
                    break;
                case 'forest':
                    r = 30 + Math.random() * 40;
                    g = 120 + Math.random() * 60;
                    b = 40 + Math.random() * 30;
                    break;
                case 'sand':
                    r = 220 + Math.random() * 35;
                    g = 200 + Math.random() * 55;
                    b = 80 + Math.random() * 40;
                    break;
                case 'soil':
                    r = 160 + Math.random() * 50;
                    g = 100 + Math.random() * 40;
                    b = 60 + Math.random() * 30;
                    break;
                case 'farmland':
                    r = 80 + Math.random() * 40;
                    g = 150 + Math.random() * 50;
                    b = 120 + Math.random() * 40;
                    break;
                default:
                    r = 150; g = 150; b = 150;
            }

            ctx.fillStyle = `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
            ctx.fillRect(x, y, 1, 1);
        }
    }

    // Конвертируем в Data URL и загружаем
    const dataURL = canvas.toDataURL();
    const img = new Image();
    img.onload = function() {
        processNDVIImage(img);
        alert('Тестовая NDVI карта создана! Теперь можно запустить симуляцию.\n\nОсобенности карты:\n• Естественные формы зон\n• Диагональные реки\n• Извилистые дороги\n• Лес распространяет пожар БЫСТРЕЕ (90%)\n• Почва медленно (30%)\n• Сельхоз очень медленно (20%)');
    };
    img.src = dataURL;
}

// Добавляем кнопку для создания тестовой карты
function addTestNDVIButton() {
    const testButton = document.createElement('button');
    testButton.className = 'calculate-btn';
    testButton.textContent = 'Создать тестовую NDVI карту';
    testButton.style.marginTop = '0.5rem';
    testButton.style.backgroundColor = 'var(--accent-orange)';
    testButton.addEventListener('click', createTestNDVI);
    
    // Добавляем кнопку в секцию загрузки NDVI
    const ndviSection = document.querySelector('.input-section');
    ndviSection.appendChild(testButton);
}