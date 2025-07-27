// js/plot.js

document.addEventListener('DOMContentLoaded', () => {
    const plotContainer = d3.select('#plot-container');
    const width = plotContainer.node().clientWidth;
    const initialHeight = 400;

    const svg = plotContainer.append('svg')
        .attr('width', width)
        .attr('height', initialHeight);

    // --- Configuration for the new Cube layout ---
    const CUBE_SIZE = 20; // The width and height of each cube
    const CUBE_RADIUS = 4; // The corner radius for the cubes
    const DOT_RADIUS = 5; // The radius of the dot inside the cube
    const X_DOMAIN = [0, Math.floor((width - 100) / CUBE_SIZE)]; // Dynamically set domain based on width

    // --- Scales ---
    const xScale = d3.scaleBand()
        .domain(d3.range(X_DOMAIN[0], X_DOMAIN[1]))
        .range([50, width - 50])
        .padding(0);

    const yScale = d3.scaleLinear()
        .range([initialHeight - 30, 30]); // Range is inverted for SVG

    // Initial parameters for data generation
    let currentMeanA = Math.floor(X_DOMAIN[1] * 0.25);
    let currentSpreadA = 3;
    let currentMeanB = Math.floor(X_DOMAIN[1] * 0.75);
    let currentSpreadB = 3;
    let currentThreshold = Math.floor(X_DOMAIN[1] * 0.5);
    let allData = [];

    // --- Data Generation (Updated for integer values) ---
    function generateClassData(mean, stdDev, count, className) {
        const data = [];
        for (let i = 0; i < count; i++) {
            let u = 0, v = 0;
            while(u === 0) u = Math.random();
            while(v === 0) v = Math.random();
            let z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
            let value = Math.round(mean + z * stdDev);
            value = Math.max(X_DOMAIN[0], Math.min(X_DOMAIN[1] - 1, value));

            data.push({ id: `${className}-${i}`, value: value, class: className });
        }
        return data;
    }

    // --- Positioning Logic for Cubes ---
    function positionCubes(data) {
        const valueCounts = {}; // Track stack height for each value
        return data.map(d => {
            const value = d.value;
            if (!valueCounts[value]) {
                valueCounts[value] = 0;
            }
            const stackIndex = valueCounts[value];
            valueCounts[value]++;

            return { ...d, x: xScale(value), y: stackIndex, originalY: -50 };
        });
    }

    // --- Render Logic for Cubes ---
    function renderCubes(data) {
        // First, determine the max stack height to adjust the Y-axis dynamically
        const maxStack = d3.max(Object.values(d3.rollup(data, v => v.length, d => d.value))) || 1;
        yScale.domain([0, maxStack]);
        const newHeight = yScale(0) + 30;
        svg.attr('height', newHeight);
        yScale.range([newHeight - 30, 30]);
        thresholdLine.attr('y2', newHeight - 30);


        const cubeGroups = svg.selectAll('.cube-group').data(data, d => d.id);

        // Exit
        cubeGroups.exit().transition().duration(500).attr('transform', 'scale(0)').remove();

        // Enter
        const enterGroups = cubeGroups.enter().append('g')
            .attr('class', 'cube-group');

        // White cube with curved edges
        enterGroups.append('rect')
            .attr('class', 'cube')
            .attr('width', CUBE_SIZE)
            .attr('height', CUBE_SIZE)
            .attr('rx', CUBE_RADIUS); // Corner radius

        // Centered colored dot
        enterGroups.append('circle')
            .attr('class', 'dot')
            .attr('cx', CUBE_SIZE / 2)
            .attr('cy', CUBE_SIZE / 2)
            .attr('r', DOT_RADIUS);

        // Update (for existing and entering groups)
        const mergedGroups = enterGroups.merge(cubeGroups);

        mergedGroups.transition()
            .duration(500)
            .delay((d, i) => i * 5)
            .attr('transform', d => `translate(${d.x}, ${yScale(d.y + 1)})`);

        mergedGroups.select('.dot')
            .style('fill', d => d.class === 'A' ? 'var(--color-class-a)' : 'var(--color-class-b)');

        // Update misclassified state
        mergedGroups.classed('misclassified', d => {
            if (d.class === 'A' && d.value >= currentThreshold) return true;
            if (d.class === 'B' && d.value < currentThreshold) return true;
            return false;
        });
    }

    // --- Scoreboard and Threshold Logic (largely unchanged, but adapted for new scale) ---
    const accuracyScoreSpan = document.getElementById('accuracy-score');
    const tpScoreSpan = document.getElementById('tp-score');
    const fpScoreSpan = document.getElementById('fp-score');
    const tnScoreSpan = document.getElementById('tn-score');
    const fnScoreSpan = document.getElementById('fn-score');

    function calculateMetrics(data, threshold) {
        let tp = 0, fp = 0, tn = 0, fn = 0;
        data.forEach(d => {
            const predictedClass = d.value < threshold ? 'A' : 'B';
            if (d.class === 'A') {
                predictedClass === 'A' ? tn++ : fp++;
            } else { // Actual Class B
                predictedClass === 'B' ? tp++ : fn++;
            }
        });
        const total = data.length;
        const accuracy = total > 0 ? ((tp + tn) / total * 100).toFixed(1) : 0;
        return { tp, fp, tn, fn, accuracy };
    }

    function updateScoreboardDisplay(metrics) {
        tpScoreSpan.textContent = metrics.tp;
        fpScoreSpan.textContent = metrics.fp;
        tnScoreSpan.textContent = metrics.tn;
        fnScoreSpan.textContent = metrics.fn;
        accuracyScoreSpan.textContent = `${metrics.accuracy}%`;
    }

    // --- Threshold Line ---
    const thresholdLine = svg.append('line')
        .attr('class', 'threshold-line')
        .attr('y1', 30)
        .attr('y2', initialHeight - 30);

    const drag = d3.drag()
        .on('drag', (event) => {
            const newX = event.x;
            const eachBand = xScale.step();
            const index = Math.round((newX - xScale.range()[0]) / eachBand);
            currentThreshold = Math.max(X_DOMAIN[0], Math.min(X_DOMAIN[1], index));
            updateThresholdLine();
            updateFeedback();
        });

    svg.call(drag); // Allow dragging anywhere on the SVG

    function updateThresholdLine() {
         thresholdLine
            .attr('x1', xScale(currentThreshold) - xScale.padding() * xScale.step() / 2)
            .attr('x2', xScale(currentThreshold) - xScale.padding() * xScale.step() / 2);
    }

    // --- Main Update Functions ---
    function updateFeedback() {
        const metrics = calculateMetrics(allData, currentThreshold);
        updateScoreboardDisplay(metrics);
        svg.selectAll('.cube-group').classed('misclassified', d => {
             if (d.class === 'A' && d.value >= currentThreshold) return true;
             if (d.class === 'B' && d.value < currentThreshold) return true;
             return false;
        });
    }

    function updatePlot() {
        let classAData = generateClassData(currentMeanA, currentSpreadA, 50, 'A');
        let classBData = generateClassData(currentMeanB, currentSpreadB, 50, 'B');
        allData = [...classAData, ...classBData];
        const positionedData = positionCubes(allData);
        renderCubes(positionedData);
        updateThresholdLine();
        updateFeedback();
    }

    // --- Sliders and Buttons (adapted for new X_DOMAIN) ---
    const meanASlider = document.getElementById('meanA');
    meanASlider.max = X_DOMAIN[1] -1;
    meanASlider.value = currentMeanA;
    meanASlider.addEventListener('input', (e) => { currentMeanA = +e.target.value; updatePlot(); });

    const meanBSlider = document.getElementById('meanB');
    meanBSlider.max = X_DOMAIN[1] - 1;
    meanBSlider.value = currentMeanB;
    meanBSlider.addEventListener('input', (e) => { currentMeanB = +e.target.value; updatePlot(); });

    const spreadASlider = document.getElementById('spreadA');
    spreadASlider.addEventListener('input', (e) => { currentSpreadA = +e.target.value; updatePlot(); });

    const spreadBSlider = document.getElementById('spreadB');
    spreadBSlider.addEventListener('input', (e) => { currentSpreadB = +e.target.value; updatePlot(); });

    // Initial Render
    updatePlot();
});