// js/plot.js

document.addEventListener('DOMContentLoaded', () => {
    const plotContainer = d3.select('#plot-container');
    const width = plotContainer.node().clientWidth;
    const height = 400; // Fixed height for the plot area

    const svg = plotContainer.append('svg')
        .attr('width', width)
        .attr('height', height);

    // Scales
    const xScale = d3.scaleLinear()
        .domain([0, 100]) // Example domain for the feature
        .range([50, width - 50]); // Padding on sides

    const yScale = d3.scaleLinear()
        .domain([0, 10]) // Max stack height (will adjust dynamically)
        .range([height - 30, 30]); // Inverted for SVG, padding on top/bottom

    // Initial parameters for data generation
    let currentMeanA = 25;
    let currentSpreadA = 5;
    let currentMeanB = 75;
    let currentSpreadB = 5;
    let currentThreshold = 50;

    // Function to generate data for a class
    function generateClassData(mean, stdDev, count, className) {
        const data = [];
        for (let i = 0; i < count; i++) {
            // Generate a random value from a normal distribution
            // Using Box-Muller transform for simplicity
            let u = 0, v = 0;
            while(u === 0) u = Math.random(); // Converting [0,1) to (0,1)
            while(v === 0) v = Math.random();
            let z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
            let value = mean + z * stdDev;

            // Clamp values to a reasonable range (e.g., 0-100)
            value = Math.max(0, Math.min(100, value));

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

    // Function to position dots in stacks with jitter
    function positionDots(data) {
        // Group data by rounded value for stacking
        const groupedData = d3.group(data, d => Math.round(d.value));

        // Calculate positions
        groupedData.forEach(group => {
            group.sort((a, b) => a.value - b.value); // Sort within group for consistent stacking
            group.forEach((d, i) => {
                d.x = xScale(d.value) + (Math.random() - 0.5) * 5; // Jitter
                d.y = yScale(i + 1) + (Math.random() - 0.5) * 5; // Stack vertically with jitter
                d.originalY = -50; // Start above for data drop
            });
        });
        return data;
    }

    // Function to render dots
    function renderDots(data) {
        const dots = svg.selectAll('.dot')
            .data(data, d => d.id); // Use id for object constancy

        // Exit
        dots.exit()
            .transition().duration(500)
            .attr('r', 0)
            .remove();

        // Enter
        const enterDots = dots.enter().append('circle')
            .attr('class', d => `dot dot-${d.class.toLowerCase()}`)
            .attr('r', 5) // Radius of dots
            .attr('cx', d => d.x)
            .attr('cy', d => d.originalY) // Start from originalY for animation
            .style('fill', d => d.class === 'A' ? 'var(--color-class-a)' : 'var(--color-class-b)')
            .style('opacity', 0); // Start invisible for data drop

        // Update (for existing and entering dots)
        enterDots.merge(dots)
            .transition()
            .duration(500) // Data drop animation duration
            .delay((d, i) => i * 5) // Staggered delay for data drop
            .attr('cx', d => d.x)
            .attr('cy', d => d.y)
            .style('opacity', 1)
            .attr('class', d => {
                let isMisclassified = false;
                if (d.class === 'A' && d.value >= currentThreshold) {
                    isMisclassified = true; // Class A dot classified as B
                } else if (d.class === 'B' && d.value < currentThreshold) {
                    isMisclassified = true; // Class B dot classified as A
                }
                return `dot dot-${d.class.toLowerCase()} ${isMisclassified ? 'misclassified' : ''}`;
            });
    }

    // Scoreboard elements
    const tpScoreSpan = document.getElementById('tp-score');
    const fpScoreSpan = document.getElementById('fp-score');
    const tnScoreSpan = document.getElementById('tn-score');
    const fnScoreSpan = document.getElementById('fn-score');
    const accuracyScoreSpan = document.getElementById('accuracy-score');

    // Function to update the scoreboard
    function updateScoreboard(data, threshold) {
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

        tpScoreSpan.textContent = tp;
        fpScoreSpan.textContent = fp;
        tnScoreSpan.textContent = tn;
        fnScoreSpan.textContent = fn;
        accuracyScoreSpan.textContent = `${accuracy}%`;
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

    // Function to update the plot based on current parameters
    function updatePlot() {
        let classAData = generateClassData(currentMeanA, currentSpreadA, 50, 'A');
        let classBData = generateClassData(currentMeanB, currentSpreadB, 50, 'B');
        let allData = positionDots([...classAData, ...classBData]);
        renderDots(allData);

        // Update threshold line position
        thresholdLine
            .attr('x1', xScale(currentThreshold))
            .attr('x2', xScale(currentThreshold));

        updateScoreboard(allData, currentThreshold);
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
        currentMeanA = 25; currentSpreadA = 5;
        currentMeanB = 75; currentSpreadB = 5;
        currentThreshold = 50; // Reset threshold for easy separation
        meanASlider.value = currentMeanA; meanAValueSpan.textContent = currentMeanA;
        spreadASlider.value = currentSpreadA; spreadAValueSpan.textContent = currentSpreadA;
        meanBSlider.value = currentMeanB; meanBValueSpan.textContent = currentMeanB;
        spreadBSlider.value = currentSpreadB; spreadBValueSpan.textContent = currentSpreadB;
        updatePlot();
    });

    document.getElementById('tricky-overlap').addEventListener('click', () => {
        currentMeanA = 40; currentSpreadA = 15;
        currentMeanB = 60; currentSpreadB = 15;
        currentThreshold = 50; // Reset threshold for tricky overlap
        meanASlider.value = currentMeanA; meanAValueSpan.textContent = currentMeanA;
        spreadASlider.value = currentSpreadA; spreadAValueSpan.textContent = currentSpreadA;
        meanBSlider.value = currentMeanB; meanBValueSpan.textContent = currentMeanB;
        spreadBSlider.value = currentSpreadB; spreadBValueSpan.textContent = currentSpreadB;
        updatePlot();
    });

    document.getElementById('unbalanced-problem').addEventListener('click', () => {
        currentMeanA = 30; currentSpreadA = 10; // Larger stack
        currentMeanB = 70; currentSpreadB = 5;  // Smaller stack
        // Note: For unbalanced, we might want different counts, but for now, keep 50/50
        currentThreshold = 50; // Reset threshold
        meanASlider.value = currentMeanA; meanAValueSpan.textContent = currentMeanA;
        spreadASlider.value = currentSpreadA; spreadAValueSpan.textContent = currentSpreadA;
        meanBSlider.value = currentMeanB; meanBValueSpan.textContent = currentMeanB;
        spreadBSlider.value = currentSpreadB; spreadBValueSpan.textContent = currentSpreadB;
        updatePlot();
    });

    // Resize listener
    window.addEventListener('resize', () => {
        const newWidth = plotContainer.node().clientWidth;
        svg.attr('width', newWidth);
        xScale.range([50, newWidth - 50]);
        svg.select('.x-axis').call(xAxis);
        // Re-render dots to adjust positions
        updatePlot(); // Re-calculate positions and render
    });
});