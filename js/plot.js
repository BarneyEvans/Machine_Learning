// js/plot.js

document.addEventListener('DOMContentLoaded', () => {
    const plotContainer = d3.select('#plot-container');
    const width = plotContainer.node().clientWidth;
    const initialHeight = 400;
    const MIN_PLOT_HEIGHT = 400;
    const MAX_STACK_CAP = 30; // Cap the maximum stack height

    const svg = plotContainer.append('svg')
        .attr('width', width)
        .attr('height', initialHeight);

    const CUBE_SIZE = 20;
    const CUBE_RADIUS = 4;
    const DOT_RADIUS = 5;
    const X_DOMAIN = [0, Math.floor((width - 100) / CUBE_SIZE)];

    const xScale = d3.scaleBand()
        .domain(d3.range(X_DOMAIN[0], X_DOMAIN[1]))
        .range([50, width - 50])
        .padding(0);

    const yScale = d3.scaleLinear(); // A simple linear scale for the axis

    let currentMeanA = Math.floor(X_DOMAIN[1] * 0.25);
    let currentSpreadA = 3;
    let currentMeanB = Math.floor(X_DOMAIN[1] * 0.75);
    let currentSpreadB = 3;
    let currentThreshold = Math.floor(X_DOMAIN[1] * 0.5);
    let allData = [];

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

    function positionCubes(data) {
        const valueCounts = {};
        return data.map(d => {
            const value = d.value;
            if (!valueCounts[value]) {
                valueCounts[value] = 0;
            }
            const stackIndex = valueCounts[value];
            valueCounts[value]++;
            return { ...d, x: xScale(value), y: stackIndex }; // y is the 0-based stack index
        });
    }

    const blueRegion = svg.append('rect').attr('id', 'blue-region').attr('fill', 'var(--color-class-a)').attr('fill-opacity', 0.2);
    const redRegion = svg.append('rect').attr('id', 'red-region').attr('fill', 'var(--color-class-b)').attr('fill-opacity', 0.2);

    function updateClassificationRegions() {
        const currentSvgHeight = svg.attr('height');
        const currentSvgWidth = svg.attr('width');
        const thresholdX = xScale(currentThreshold) - xScale.padding() * xScale.step() / 2;
        blueRegion.attr('x', 0).attr('y', 0).attr('width', thresholdX).attr('height', currentSvgHeight - 30);
        redRegion.attr('x', thresholdX).attr('y', 0).attr('width', currentSvgWidth - thresholdX).attr('height', currentSvgHeight - 30);
    }

    const xAxisGroup = svg.append('g').attr('class', 'x-axis');
    const yAxisGroup = svg.append('g').attr('class', 'y-axis').attr('transform', `translate(40, 0)`);

    function updateXAxis() {
        const currentSvgHeight = svg.attr('height');
        xAxisGroup.attr('transform', `translate(0, ${currentSvgHeight - 30})`);
        const xAxis = d3.axisBottom(xScale);
        xAxisGroup.call(xAxis);
    }

    function updateYAxis(maxStack) {
        const yAxis = d3.axisLeft(yScale).ticks(maxStack).tickFormat(d3.format('d'));
        yAxisGroup.call(yAxis);
        yAxisGroup.select(".domain").remove();
    }

    function renderCubes(data) {
        let maxStack = d3.max(Array.from(d3.rollup(data, v => v.length, d => d.value).values())) || 1;
        maxStack = Math.min(maxStack, MAX_STACK_CAP); // Cap the max stack height

        const paddingTop = 30;
        const paddingBottom = 40;
        const requiredHeightForCubes = maxStack * CUBE_SIZE;
        let newHeight = requiredHeightForCubes + paddingTop + paddingBottom;
        newHeight = Math.max(newHeight, MIN_PLOT_HEIGHT);

        svg.attr('height', newHeight);
        plotContainer.style('height', `${newHeight}px`).style('transition', 'height 0.5s ease-out');

        // Define the y-axis scale to perfectly center the labels
        yScale.domain([1, maxStack])
              .range([(newHeight - paddingBottom) - (0.5 * CUBE_SIZE), (newHeight - paddingBottom) - (maxStack - 0.5) * CUBE_SIZE]);

        thresholdLine.attr('y2', newHeight - 30);

        updateYAxis(maxStack);
        updateXAxis();
        updateClassificationRegions();

        const cubeGroups = svg.selectAll('.cube-group').data(data, d => d.id);

        cubeGroups.exit().transition().duration(500).attr('transform', 'scale(0)').remove();

        const enterGroups = cubeGroups.enter().append('g').attr('class', 'cube-group');
        enterGroups.append('rect').attr('class', 'cube').attr('width', CUBE_SIZE).attr('height', CUBE_SIZE).attr('rx', CUBE_RADIUS);
        enterGroups.append('circle').attr('class', 'dot').attr('cx', CUBE_SIZE / 2).attr('cy', CUBE_SIZE / 2).attr('r', DOT_RADIUS);

        const mergedGroups = enterGroups.merge(cubeGroups);

        // Manually calculate y-position for perfect stacking, no gaps
        mergedGroups.transition().duration(500).delay((d, i) => i * 5)
            .attr('transform', d => {
                const yPos = (newHeight - paddingBottom) - (d.y + 1) * CUBE_SIZE;
                return `translate(${d.x}, ${yPos})`;
            });

        mergedGroups.select('.dot').style('fill', d => d.class === 'A' ? 'var(--color-class-a)' : 'var(--color-class-b)');
        mergedGroups.classed('misclassified', d => (d.class === 'A' && d.value >= currentThreshold) || (d.class === 'B' && d.value < currentThreshold));
    }

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
            } else {
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

    const thresholdLine = svg.append('line').attr('class', 'threshold-line').attr('y1', 30).attr('y2', initialHeight - 30);

    const drag = d3.drag().on('drag', (event) => {
        const newX = event.x;
        const eachBand = xScale.step();
        const index = Math.round((newX - xScale.range()[0]) / eachBand);
        currentThreshold = Math.max(X_DOMAIN[0], Math.min(X_DOMAIN[1], index));
        updateThresholdLine();
        updateFeedback();
        updateClassificationRegions();
    });

    svg.call(drag);

    function updateThresholdLine() {
        const thresholdX = xScale(currentThreshold) - xScale.padding() * xScale.step() / 2;
        thresholdLine.attr('x1', thresholdX).attr('x2', thresholdX);
    }

    function updateFeedback() {
        const metrics = calculateMetrics(allData, currentThreshold);
        updateScoreboardDisplay(metrics);
        svg.selectAll('.cube-group').classed('misclassified', d => (d.class === 'A' && d.value >= currentThreshold) || (d.class === 'B' && d.value < currentThreshold));
    }

    function updatePlot() {
        let classAData = generateClassData(currentMeanA, currentSpreadA, 50, 'A');
        let classBData = generateClassData(currentMeanB, currentSpreadB, 50, 'B');
        allData = [...classAData, ...classBData];
        const positionedData = positionCubes(allData);
        renderCubes(positionedData);
        updateThresholdLine();
        updateFeedback();
        updateClassificationRegions();
    }

    const meanASlider = document.getElementById('meanA');
    meanASlider.max = X_DOMAIN[1] - 1;
    meanASlider.value = currentMeanA;
    meanASlider.addEventListener('input', (e) => {
        currentMeanA = +e.target.value;
        document.getElementById('meanA-value').textContent = currentMeanA;
        updatePlot();
    });

    const spreadASlider = document.getElementById('spreadA');
    spreadASlider.addEventListener('input', (e) => {
        currentSpreadA = +e.target.value;
        document.getElementById('spreadA-value').textContent = currentSpreadA;
        updatePlot();
    });

    const meanBSlider = document.getElementById('meanB');
    meanBSlider.max = X_DOMAIN[1] - 1;
    meanBSlider.value = currentMeanB;
    meanBSlider.addEventListener('input', (e) => {
        currentMeanB = +e.target.value;
        document.getElementById('meanB-value').textContent = currentMeanB;
        updatePlot();
    });

    const spreadBSlider = document.getElementById('spreadB');
    spreadBSlider.addEventListener('input', (e) => {
        currentSpreadB = +e.target.value;
        document.getElementById('spreadB-value').textContent = currentSpreadB;
        updatePlot();
    });

    updatePlot();
});