// js/plot.js

document.addEventListener('DOMContentLoaded', () => {
    const plotContainer = d3.select('#plot-container');
    const width = plotContainer.node().clientWidth;
    const height = 400; // Fixed height for the plot area

    const svg = plotContainer.append('svg')
        .attr('width', width)
        .attr('height', height);

    // Cube and Dot dimensions
    const cubeSize = 15; // Size of the square cube
    const dotRadius = 4; // Radius of the inner dot

    // Scales
    const xScale = d3.scaleLinear()
        .domain([0, 50]) // New domain for discrete slots (0-50)
        .range([50, width - 50]); // Padding on sides

    let yScale = d3.scaleLinear(); // Will be updated dynamically

    // Initial parameters for data generation
    let currentMeanA = 15; // Adjusted for new domain
    let currentSpreadA = 5;
    let currentMeanB = 35; // Adjusted for new domain
    let currentSpreadB = 5;
    let currentThreshold = 25; // Adjusted for new domain
    let allData = []; // Store current data globally

    // Variables for Guess & Compare
    let lockedGuessThreshold = null;
    let optimalThreshold = null;

    // Function to generate data for a class
    function generateClassData(mean, stdDev, count, className) {
        const data = [];
        for (let i = 0; i < count; i++) {
            // Generate a random value from a normal distribution
            let u = 0, v = 0;
            while(u === 0) u = Math.random();
            while(v === 0) v = Math.random();
            let z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
            let value = mean + z * stdDev;

            // Clamp values to a reasonable range (e.g., 0-50 for new domain)
            value = Math.max(0, Math.min(50, value));

            data.push({
                id: `${className}-${i}`,
                value: value,
                class: className,
                x: 0, // Placeholder for calculated x
                y: 0, // Placeholder for calculated y
                originalY: 0 // For data drop animation
            });
        }
        return data;
    }

    // Function to position cubes in precise stacks
    function positionDots(data) {
        // Group data by rounded value for stacking
        const groupedData = d3.group(data, d => Math.round(d.value));
        let maxStackHeight = 0;

        // Calculate positions
        groupedData.forEach(group => {
            group.sort((a, b) => a.value - b.value); // Sort within group for consistent stacking
            group.forEach((d, i) => {
                // Position the top-left corner of the cube
                d.x = xScale(Math.round(d.value)) - cubeSize / 2; // Centered on the integer value
                d.y = height - 30 - (i + 1) * cubeSize; // Stack vertically from bottom
                d.originalY = -cubeSize; // Start above for data drop
            });
            if (group.length > maxStackHeight) {
                maxStackHeight = group.length;
            }
        });

        // Update yScale domain based on max stack height
        yScale.domain([0, maxStackHeight + 1]) // +1 for some padding at the top
              .range([height - 30, 30]); // Inverted for SVG, padding on top/bottom

        // Re-calculate y positions based on updated yScale
        groupedData.forEach(group => {
            group.forEach((d, i) => {
                d.y = yScale(i + 1) - cubeSize; // Stack vertically from bottom
            });
        });

        return data;
    }

    // Function to render cubes with inner dots
    function renderDots(data) {
        const dataPoints = svg.selectAll('.data-point')
            .data(data, d => d.id); // Use id for object constancy

        // Exit
        dataPoints.exit()
            .transition().duration(500)
            .attr('transform', `translate(0, ${height + 50})`)
            .style('opacity', 0)
            .remove();

        // Enter
        const enterDataPoints = dataPoints.enter().append('g')
            .attr('class', 'data-point')
            .attr('transform', d => `translate(${d.x}, ${d.originalY})`)
            .style('opacity', 0);

        enterDataPoints.append('rect')
            .attr('width', cubeSize)
            .attr('height', cubeSize)
            .attr('fill', 'white')
            .attr('stroke', '#333')
            .attr('stroke-width', 1)
            .attr('rx', 3) // Rounded corners
            .attr('ry', 3); // Rounded corners

        enterDataPoints.append('circle')
            .attr('cx', cubeSize / 2)
            .attr('cy', cubeSize / 2)
            .attr('r', dotRadius)
            .style('fill', d => d.class === 'A' ? 'var(--color-class-a)' : 'var(--color-class-b)');

        // Update (for existing and entering data points)
        enterDataPoints.merge(dataPoints)
            .transition()
            .duration(1000) // Data drop animation duration
            .delay((d, i) => i * 10) // Staggered delay for data drop
            .attr('transform', d => `translate(${d.x}, ${d.y})`)
            .style('opacity', 1)
            .attr('class', d => {
                let isMisclassified = false;
                if (d.class === 'A' && d.value >= currentThreshold) {
                    isMisclassified = true; // Class A dot classified as B
                } else if (d.class === 'B' && d.value < currentThreshold) {
                    isMisclassified = true; // Class B dot classified as A
                }
                return `data-point ${isMisclassified ? 'misclassified' : ''}`;
            });
    }

    // Scoreboard elements
    const tpScoreSpan = document.getElementById('tp-score');
    const fpScoreSpan = document.getElementById('fp-score');
    const tnScoreSpan = document.getElementById('tn-score');
    const fnScoreSpan = document.getElementById('fn-score');
    const accuracyScoreSpan = document.getElementById('accuracy-score');

    // Function to calculate classification metrics
    function calculateMetrics(data, threshold) {
        let tp = 0, fp = 0, tn = 0, fn = 0;

        data.forEach(d => {
            if (d.class === 'A') { // Actual Class A
                if (d.value < threshold) {
                    tn++; // Correctly classified as A (Negative class in this context)
                } else {
                    fp++; // Incorrectly classified as B (Positive class in this context)
                }
            } else { // Actual Class B
                if (d.value >= threshold) {
                    tp++; // Correctly classified as B (Positive class in this context)
                } else {
                    fn++; // Incorrectly classified as A (Negative class in this context)
                }
            }
        });
        const total = data.length;
        const correct = tp + tn;
        const accuracy = total > 0 ? (correct / total * 100).toFixed(1) : 0;
        return { tp, fp, tn, fn, accuracy };
    }

    // Function to update the scoreboard display
    function updateScoreboardDisplay(metrics, prefix = '') {
        document.getElementById(`${prefix}tp-score`).textContent = metrics.tp;
        document.getElementById(`${prefix}fp-score`).textContent = metrics.fp;
        document.getElementById(`${prefix}tn-score`).textContent = metrics.tn;
        document.getElementById(`${prefix}fn-score`).textContent = metrics.fn;
        document.getElementById(`${prefix}accuracy-score`).textContent = `${metrics.accuracy}%`;
    }

    // Threshold line
    const thresholdLine = svg.append('line')
        .attr('class', 'threshold-line')
        .attr('x1', xScale(currentThreshold))
        .attr('y1', 30)
        .attr('x2', xScale(currentThreshold))
        .attr('y2', height - 30)
        .style('stroke', 'var(--color-threshold)')
        .style('stroke-width', 3);

    // Draggable threshold line
    const drag = d3.drag()
        .on('drag', (event) => {
            const newX = event.x;
            const clampedX = Math.max(xScale.range()[0], Math.min(xScale.range()[1], newX));
            currentThreshold = xScale.invert(clampedX);
            thresholdLine
                .attr('x1', clampedX)
                .attr('x2', clampedX);
            updatePlot(); // Re-render dots and update scoreboard on drag
        });

    thresholdLine.call(drag);

    // Function to find the optimal threshold
    function findOptimalThreshold(data) {
        let bestThreshold = 0;
        let maxAccuracy = -1;

        // Iterate through all possible integer thresholds
        for (let t = 0; t <= 50; t += 0.1) { // Adjusted for new domain
            const metrics = calculateMetrics(data, t);
            if (metrics.accuracy > maxAccuracy) {
                maxAccuracy = metrics.accuracy;
                bestThreshold = t;
            }
        }
        return bestThreshold;
    }

    // Function to update the plot based on current parameters
    function updatePlot() {
        let classAData = generateClassData(currentMeanA, currentSpreadA, 50, 'A');
        let classBData = generateClassData(currentMeanB, currentSpreadB, 50, 'B');
        allData = positionDots([...classAData, ...classBData]); // Update global allData
        renderDots(allData);

        // Update threshold line position
        thresholdLine
            .attr('x1', xScale(currentThreshold))
            .attr('x2', xScale(currentThreshold));

        // Update current scoreboard
        const currentMetrics = calculateMetrics(allData, currentThreshold);
        updateScoreboardDisplay(currentMetrics, '');

        // Update locked guess scoreboard if active
        if (lockedGuessThreshold !== null) {
            const lockedMetrics = calculateMetrics(allData, lockedGuessThreshold);
            // Assuming you'll have separate HTML elements for locked guess scoreboard
            // For now, let's just log or display in a placeholder
            console.log('Locked Guess Metrics:', lockedMetrics);
        }

        // Update optimal scoreboard if active
        if (optimalThreshold !== null) {
            const optimalMetrics = calculateMetrics(allData, optimalThreshold);
            // Assuming you'll have separate HTML elements for optimal scoreboard
            // For now, let's just log or display in a placeholder
            console.log('Optimal Metrics:', optimalMetrics);
        }
    }

    // Initial render
    updatePlot();

    // Add a simple x-axis
    const xAxis = d3.axisBottom(xScale);
    svg.append('g')
        .attr('class', 'x-axis')
        .attr('transform', `translate(0, ${height - 30})`)
        .call(xAxis);

    // Slider event listeners
    const meanASlider = document.getElementById('meanA');
    const meanAValueSpan = document.getElementById('meanA-value');
    meanASlider.addEventListener('input', (event) => {
        currentMeanA = +event.target.value;
        meanAValueSpan.textContent = currentMeanA;
        updatePlot();
    });

    const spreadASlider = document.getElementById('spreadA');
    const spreadAValueSpan = document.getElementById('spreadA-value');
    spreadASlider.addEventListener('input', (event) => {
        currentSpreadA = +event.target.value;
        spreadAValueSpan.textContent = currentSpreadA;
        updatePlot();
    });

    const meanBSlider = document.getElementById('meanB');
    const meanBValueSpan = document.getElementById('meanB-value');
    meanBSlider.addEventListener('input', (event) => {
        currentMeanB = +event.target.value;
        meanBValueSpan.textContent = currentMeanB;
        updatePlot();
    });

    const spreadBSlider = document.getElementById('spreadB');
    const spreadBValueSpan = document.getElementById('spreadB-value');
    spreadBSlider.addEventListener('input', (event) => {
        currentSpreadB = +event.target.value;
        spreadBValueSpan.textContent = currentSpreadB;
        updatePlot();
    });

    // Scenario buttons event listeners
    document.getElementById('easy-separation').addEventListener('click', () => {
        currentMeanA = 15; currentSpreadA = 5;
        currentMeanB = 35; currentSpreadB = 5;
        currentThreshold = 25; // Reset threshold for easy separation
        meanASlider.value = currentMeanA; meanAValueSpan.textContent = currentMeanA;
        spreadASlider.value = currentSpreadA; spreadAValueSpan.textContent = currentSpreadA;
        meanBSlider.value = currentMeanB; meanBValueSpan.textContent = currentMeanB;
        spreadBSlider.value = currentSpreadB; spreadBValueSpan.textContent = currentSpreadB;
        updatePlot();
    });

    document.getElementById('tricky-overlap').addEventListener('click', () => {
        currentMeanA = 20; currentSpreadA = 10;
        currentMeanB = 30; currentSpreadB = 10;
        currentThreshold = 25; // Reset threshold for tricky overlap
        meanASlider.value = currentMeanA; meanAValueSpan.textContent = currentMeanA;
        spreadASlider.value = currentSpreadA; spreadAValueSpan.textContent = currentSpreadA;
        meanBSlider.value = currentMeanB; meanBValueSpan.textContent = currentMeanB;
        spreadBSlider.value = currentSpreadB; spreadBValueSpan.textContent = currentSpreadB;
        updatePlot();
    });

    document.getElementById('unbalanced-problem').addEventListener('click', () => {
        currentMeanA = 10; currentSpreadA = 8; // Larger stack
        currentMeanB = 40; currentSpreadB = 3;  // Smaller stack
        // Note: For unbalanced, we might want different counts, but for now, keep 50/50
        currentThreshold = 25; // Reset threshold
        meanASlider.value = currentMeanA; meanAValueSpan.textContent = currentMeanA;
        spreadASlider.value = currentSpreadA; spreadAValueSpan.textContent = currentSpreadA;
        meanBSlider.value = currentMeanB; meanBValueSpan.textContent = currentMeanB;
        spreadBSlider.value = currentSpreadB; spreadBValueSpan.textContent = currentSpreadB;
        updatePlot();
    });

    // Guess & Compare buttons
    document.getElementById('lock-guess').addEventListener('click', () => {
        lockedGuessThreshold = currentThreshold;
        // Draw locked guess line
        svg.selectAll('.locked-guess-line').remove(); // Remove previous locked line
        svg.append('line')
            .attr('class', 'locked-guess-line')
            .attr('x1', xScale(lockedGuessThreshold))
            .attr('y1', 30)
            .attr('x2', xScale(lockedGuessThreshold))
            .attr('y2', height - 30)
            .style('stroke', 'gray') // Semi-transparent
            .style('stroke-width', 2)
            .style('stroke-dasharray', ('5,5'));

        // Update locked guess scoreboard (need to add HTML for this)
        const lockedMetrics = calculateMetrics(allData, lockedGuessThreshold);
        console.log('Locked Guess Metrics:', lockedMetrics); // For now, log to console
    });

    document.getElementById('show-optimal').addEventListener('click', () => {
        optimalThreshold = findOptimalThreshold(allData);
        // Draw optimal line
        svg.selectAll('.optimal-line').remove(); // Remove previous optimal line
        svg.append('line')
            .attr('class', 'optimal-line')
            .attr('x1', xScale(optimalThreshold))
            .attr('y1', 30)
            .attr('x2', xScale(optimalThreshold))
            .attr('y2', height - 30)
            .style('stroke', 'gold') // Bold
            .style('stroke-width', 4);

        // Update optimal scoreboard (need to add HTML for this)
        const optimalMetrics = calculateMetrics(allData, optimalThreshold);
        console.log('Optimal Metrics:', optimalMetrics); // For now, log to console
    });

    // Resize listener
    window.addEventListener('resize', () => {
        const newWidth = plotContainer.node().clientWidth;
        svg.attr('width', newWidth);
        xScale.range([50, newWidth - 50]);
        svg.select('.x-axis').call(xAxis);
        // Re-render dots and lines to adjust positions
        updatePlot();

        // Redraw locked and optimal lines on resize
        if (lockedGuessThreshold !== null) {
            svg.select('.locked-guess-line')
                .attr('x1', xScale(lockedGuessThreshold))
                .attr('x2', xScale(lockedGuessThreshold));
        }
        if (optimalThreshold !== null) {
            svg.select('.optimal-line')
                .attr('x1', xScale(optimalThreshold))
                .attr('x2', xScale(optimalThreshold));
        }
    });
});