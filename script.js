// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    // Установка даты обновления
    document.getElementById('update-date').textContent = new Date().toLocaleString();
    
    // Инициализация карты с увеличенной сеткой
    initMap(60, 60);
    
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
    'forest': 0.8,   // Высокая скорость
    'soil': 0.4,     // Средняя скорость
    'farmland': 0.3, // Низкая скорость
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
function initMap(rows = 60, cols = 60) {
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
    const cols = 60;
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

// УЛУЧШЕННАЯ функция классификации цвета NDVI
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

// УЛУЧШЕННАЯ обработка NDVI изображения
function processNDVIImage(img) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    // Устанавливаем размеры canvas под размер сетки
    const mapGrid = document.getElementById('map-grid');
    const cols = 60;
    const rows = 60;
    
    canvas.width = cols;
    canvas.height = rows;
    
    try {
        // Рисуем изображение с масштабированием под размер сетки
        ctx.drawImage(img, 0, 0, cols, rows);
        
        // Анализируем пиксели
        const imageData = ctx.getImageData(0, 0, cols, rows);
        const data = imageData.data;
        
        const mapCells = document.querySelectorAll('.map-cell');
        
        let classifiedCount = 0;
        
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
                    if (surfaceType !== 'unknown') {
                        classifiedCount++;
                    }
                }
            }
        }
        
        alert(`NDVI анализ завершен! Классифицировано ${classifiedCount} из ${cols * rows} клеток.`);
        
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
    initMap(60, 60);
    
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
    const cols = 60;
    const rows = 60;
    
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
                    }, 500 + Math.random() * 1000);
                }, Math.random() * 800);
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

// УЛУЧШЕННАЯ функция для создания тестовой NDVI карты
function createTestNDVI() {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const cols = 60;
    const rows = 60;
    
    canvas.width = cols;
    canvas.height = rows;
    
    // Создаем тестовую карту с разными типами поверхностей
    for (let x = 0; x < cols; x++) {
        for (let y = 0; y < rows; y++) {
            let r, g, b;
            
            // Создаем реалистичные паттерны
            if (x < 15 && y < 15) {
                // Вода - синий (озеро в левом верхнем углу)
                r = 0; g = 100; b = 255;
            } else if (x > 45 && y < 20) {
                // Песок - желтый (пляж в правом верхнем углу)
                r = 240; g = 230; b = 50;
            } else if (x > 35 && x < 55 && y > 40 && y < 55) {
                // Сельхозземли - бирюзовый (поле в правом нижнем углу)
                r = 70; g = 180; b = 170;
            } else if ((x > 10 && x < 50 && y > 10 && y < 50) || 
                      (x > 20 && x < 40 && y > 5 && y < 25)) {
                // Лес - зеленый (большой лесной массив)
                r = 40; g = 160; b = 60;
            } else if (x < 30 || y < 30) {
                // Почва - красный (открытые участки)
                r = 180; g = 80; b = 60;
            } else {
                // Смешанная местность
                if (Math.random() > 0.5) {
                    r = 50; g = 140; b = 50; // Лес
                } else {
                    r = 160; g = 100; b = 70; // Почва
                }
            }
            
            // Добавляем небольшие вариации для реалистичности
            r += Math.random() * 20 - 10;
            g += Math.random() * 20 - 10;
            b += Math.random() * 20 - 10;
            
            // Ограничиваем значения
            r = Math.max(0, Math.min(255, r));
            g = Math.max(0, Math.min(255, g));
            b = Math.max(0, Math.min(255, b));
            
            ctx.fillStyle = `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
            ctx.fillRect(x, y, 1, 1);
        }
    }
    
    // Конвертируем в Data URL и загружаем
    const dataURL = canvas.toDataURL();
    const img = new Image();
    img.onload = function() {
        processNDVIImage(img);
        alert('Тестовая NDVI карта создана! Теперь можно запустить симуляцию.');
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