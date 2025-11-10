// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    // Установка даты обновления
    document.getElementById('update-date').textContent = new Date().toLocaleString();
    
    // Инициализация карты
    initMap();
    
    // Инициализация мини-карты
    initMiniMap();
    
    // Назначение обработчиков событий
    document.getElementById('calculate-btn').addEventListener('click', calculateFWI);
    document.getElementById('reset-btn').addEventListener('click', resetMap);
    document.getElementById('simulate-btn').addEventListener('click', startSimulation);
});

// Инициализация основной карты
function initMap() {
    const mapGrid = document.getElementById('map-grid');
    mapGrid.innerHTML = '';
    
    // Создаем 30x30 клеток для карты
    for (let i = 0; i < 900; i++) {
        const cell = document.createElement('div');
        cell.className = 'map-cell';
        
        // Случайным образом назначаем уровень опасности
        const random = Math.random();
        if (random < 0.6) {
            cell.classList.add('low');
        } else if (random < 0.8) {
            cell.classList.add('medium');
        } else if (random < 0.95) {
            cell.classList.add('high');
        } else {
            cell.classList.add('extreme');
        }
        
        // Добавляем обработчик клика для установки пожара
        cell.addEventListener('click', function() {
            if (!this.classList.contains('fire')) {
                this.classList.add('fire');
            } else {
                this.classList.remove('fire');
            }
        });
        
        mapGrid.appendChild(cell);
    }
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

// Расчет индекса пожарной опасности
function calculateFWI() {
    const temperature = parseFloat(document.getElementById('temperature').value) || 0;
    const humidity = parseFloat(document.getElementById('humidity').value) || 0;
    const windSpeed = parseFloat(document.getElementById('wind-speed').value) || 0;
    const precipitation = parseFloat(document.getElementById('precipitation').value) || 0;
    
    // Упрощенный расчет FWI (в реальной системе здесь была бы сложная формула)
    let fwi = (temperature * 0.5) + ((100 - humidity) * 0.3) + (windSpeed * 0.15) - (precipitation * 2);
    fwi = Math.max(0, fwi); // FWI не может быть отрицательным
    
    // Обновляем виджет результатов
    const resultsWidget = document.getElementById('results-widget');
    resultsWidget.innerHTML = `
        <div class="results-active">
            <h3>Расчёт выполнен</h3>
            <p>Индекс FWI: <strong>${fwi.toFixed(2)}</strong></p>
            <p>Уровень опасности: <strong>${getDangerLevel(fwi)}</strong></p>
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

// Распространение пожара на соседние клетки
function spreadFire(cells, index) {
    if (index >= 0 && index < cells.length) {
        cells[index].classList.add('fire');
    }
}

// Сброс карты
function resetMap() {
    initMap();
    
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
    
    // Распространяем пожар от каждой горящей клетки
    fireCells.forEach(index => {
        spreadToNeighbors(mapCells, index);
    });
}

// Распространение пожара к соседям на основной карте
function spreadToNeighbors(cells, index) {
    const rows = 30;
    const cols = 30;
    
    // Определяем индексы соседей (вверх, вниз, влево, вправо)
    const neighbors = [
        index - cols,    // сверху
        index + cols,    // снизу
        index - 1,       // слева
        index + 1        // справа
    ];
    
    neighbors.forEach(neighborIndex => {
        // Проверяем, что сосед существует и не выходит за границы
        if (neighborIndex >= 0 && neighborIndex < cells.length && 
            Math.abs((neighborIndex % cols) - (index % cols)) <= 1) {
            
            // С вероятностью 70% поджигаем соседа, если он не горит уже
            if (!cells[neighborIndex].classList.contains('fire') && Math.random() < 0.7) {
                // Задержка для анимации
                setTimeout(() => {
                    cells[neighborIndex].classList.add('fire');
                }, Math.random() * 1000);
            }
        }
    });
}