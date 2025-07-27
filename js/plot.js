// js/plot.js
// Welcome to the Critter Sorter!
// This code makes our fun sorting game work.

document.addEventListener('DOMContentLoaded', () => {
    // --- The Main Play Area ---
    // We're selecting the big box where our critters will live.
    const plotContainer = d3.select('#plot-container');

    // Let's set a fixed size for our play area.
    const width = 700;
    const height = 310;
    const MAX_CRITTERS_IN_STACK = 15; // A critter can't stand on a stack that's too high!
    const X_RANGE = [0, 30]; // Our world goes from 0 to 30.

    // This creates the actual SVG canvas inside the plot container.
    // Think of it as the stage for our critters.
    const svg = plotContainer.append('svg')
        .attr('width', width)
        .attr('height', height);

    // --- Important Numbers and Tools ---
    const CRITTER_SIZE = 20; // How big each critter is.
    const PADDING_TOP = 30;
    const PADDING_BOTTOM = 40;

    // --- Scales: From Game Numbers to Screen Pixels ---
    // This scale helps us figure out WHERE on the screen to place our critters horizontally.
    const xScale = d3.scaleBand()
        .domain(d3.range(X_RANGE[0], X_RANGE[1]))
        .range([50, width - 50])
        .padding(0.1); // A little space between critter stacks.

    // This scale helps us place critters vertically.
    const yScale = d3.scaleLinear()
        .domain([0, MAX_CRITTERS_IN_STACK - 1])
        .range([height - PADDING_BOTTOM - CRITTER_SIZE, PADDING_TOP]);

    // --- Game State: Remembering Our Settings ---
    let centerA = Math.floor(X_RANGE[1] * 0.25);
    let wanderA = 3;
    let centerB = Math.floor(X_RANGE[1] * 0.75);
    let wanderB = 3;
    let magicFencePosition = Math.floor(X_RANGE[1] * 0.5);
    let allCrittersData = []; // This will hold all our critters.
    let guessLocked = false;
    let lockedGuessLine;
    let optimalLine;


    // --- Critter Creation ---
    // A function to create a group of critters.
    function generateCritterData(center, wander, count, critterType) {
        const data = [];
        for (let i = 0; i < count; i++) {
            // This is a fancy math way to make critters cluster around their "center".
            let u = 0, v = 0;
            while(u === 0) u = Math.random();
            while(v === 0) v = Math.random();
            let z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
            let value = Math.round(center + z * wander);
            // Make sure critters don't wander off the edge of the world!
            value = Math.max(X_RANGE[0], Math.min(X_RANGE[1] - 1, value));
            data.push({ id: `${critterType}-${i}`, value: value, type: critterType });
        }
        return data;
    }

    // --- Stacking the Critters ---
    // This function figures out where each critter should sit so they stack up nicely.
    function positionCritters(data) {
        const valueCounts = {};
        const positioned = [];
        data.forEach(d => {
            const value = d.value;
            if (!valueCounts[value]) {
                valueCounts[value] = 0;
            }
            // We only add the critter if the stack isn't too high.
            if (valueCounts[value] < MAX_CRITTERS_IN_STACK) {
                const stackIndex = valueCounts[value];
                valueCounts[value]++;
                positioned.push({ ...d, x: xScale(value), y: stackIndex });
            }
        });
        return positioned;
    }

    // --- Drawing The World ---
    // Let's draw the colored background areas for each critter type.
    const blueHome = svg.append('rect').attr('id', 'blue-home').attr('fill', 'var(--color-class-a)').attr('fill-opacity', 0.2);
    const orangeHome = svg.append('rect').attr('id', 'orange-home').attr('fill', 'var(--color-class-b)').attr('fill-opacity', 0.2);

    function updateHomeRegions() {
        const fenceX = xScale(magicFencePosition);
        blueHome.attr('x', 0).attr('y', 0).attr('width', fenceX).attr('height', height - PADDING_BOTTOM + 10);
        orangeHome.attr('x', fenceX).attr('y', 0).attr('width', width - fenceX).attr('height', height - PADDING_BOTTOM + 10);
    }

    // Let's draw the number line at the bottom.
    const xAxisGroup = svg.append('g').attr('class', 'x-axis')
        .attr('transform', `translate(0, ${height - 30})`);
    const xAxis = d3.axisBottom(xScale).tickValues(xScale.domain().filter(d => d % 5 === 0)); // Show every 5th number
    xAxisGroup.call(xAxis);
    xAxisGroup.select(".domain").remove();


    // --- Bringing Critters to Life! ---
    function renderCritters(data) {
        updateHomeRegions();

        const critterGroups = svg.selectAll('.critter-group').data(data, d => d.id);

        // Remove old critters that are no longer here.
        critterGroups.exit().transition().duration(500).attr('transform', 'scale(0)').remove();

        // Create new critters!
        const enterGroups = critterGroups.enter().append('g').attr('class', 'critter-group');

        // Add the critter's body
        enterGroups.append('rect')
            .attr('class', 'critter-body')
            .attr('width', CRITTER_SIZE)
            .attr('height', CRITTER_SIZE)
            .attr('rx', 6); // Rounded corners

        // Add the critter's eyes
        enterGroups.append('circle').attr('class', 'eye left-eye').attr('cx', 6).attr('cy', 8).attr('r', 2);
        enterGroups.append('circle').attr('class', 'eye right-eye').attr('cx', 14).attr('cy', 8).attr('r', 2);

        const mergedGroups = enterGroups.merge(critterGroups);

        // Move critters to their new positions with a fun, bouncy animation.
        mergedGroups.transition().duration(800).delay((d, i) => i * 5)
            .ease(d3.easeElasticOut)
            .attr('transform', d => `translate(${d.x}, ${yScale(d.y)})`);

        // Color the critters based on their type (Blue or Orange).
        mergedGroups.select('.critter-body')
            .style('fill', d => d.type === 'A' ? 'var(--color-class-a)' : 'var(--color-class-b)');
        
        // Update whether a critter is in the wrong home.
        updateMistakes();
    }

    // --- The Scoreboard ---
    const accuracyScoreSpan = document.getElementById('accuracy-score');
    const tpScoreSpan = document.getElementById('tp-score'); // Orange correct
    const fpScoreSpan = document.getElementById('fp-score'); // Orange mistaken
    const tnScoreSpan = document.getElementById('tn-score'); // Blue correct
    const fnScoreSpan = document.getElementById('fn-score'); // Blue missed

    function calculateScore(data, fencePosition) {
        let orangeCorrect = 0, orangeMistaken = 0, blueCorrect = 0, blueMissed = 0;
        data.forEach(d => {
            const predictedHome = d.value < fencePosition ? 'A' : 'B'; // A=Blue, B=Orange
            if (d.type === 'A') { // If it's a Blue Critter...
                predictedHome === 'A' ? blueCorrect++ : orangeMistaken++; // Is it in Blue or Orange home?
            } else { // If it's an Orange Critter...
                predictedHome === 'B' ? orangeCorrect++ : blueMissed++; // Is it in Orange or Blue home?
            }
        });
        const total = data.length;
        const accuracy = total > 0 ? ((orangeCorrect + blueCorrect) / total * 100).toFixed(0) : 0;
        return { orangeCorrect, orangeMistaken, blueCorrect, blueMissed, accuracy };
    }

    function updateScoreboardDisplay(score) {
        tpScoreSpan.textContent = score.orangeCorrect;
        fpScoreSpan.textContent = score.orangeMistaken;
        tnScoreSpan.textContent = score.blueCorrect;
        fnScoreSpan.textContent = score.blueMissed;
        accuracyScoreSpan.textContent = `${score.accuracy}%`;
    }

    // --- The Magic Fence ---
    const magicFence = svg.append('line')
        .attr('class', 'threshold-line')
        .attr('y1', PADDING_TOP)
        .attr('y2', height - 30);

    const dragHandler = d3.drag().on('drag', (event) => {
        if (guessLocked) return; // Don't allow dragging if the guess is locked

        const newX = event.x;
        const eachBand = xScale.step();
        const index = Math.round((newX - xScale.range()[0]) / eachBand);
        magicFencePosition = Math.max(X_RANGE[0], Math.min(X_RANGE[1], index));
        
        updateMagicFence();
        updateHomeRegions();
        updateFeedback();
    });

    svg.call(dragHandler);

    function updateMagicFence() {
        if (guessLocked) {
             magicFence.style('display', 'none');
        } else {
            magicFence.style('display', 'block');
            const fenceX = xScale(magicFencePosition);
            magicFence.attr('x1', fenceX).attr('x2', fenceX);
        }
    }
    
    // --- Feedback and Mistakes ---
    function updateMistakes() {
        svg.selectAll('.critter-group').each(function(d) {
            const isMistaken = (d.type === 'A' && d.value >= magicFencePosition) || (d.type === 'B' && d.value < magicFencePosition);
            d3.select(this).classed('misclassified', isMistaken);
        });
    }

    function updateFeedback() {
        const score = calculateScore(allCrittersData, magicFencePosition); 
        updateScoreboardDisplay(score);
        updateMistakes();
    }
    
    // --- The Main Game Loop ---
    function updateGame() {
        // Create our two groups of critters.
        let blueCritters = generateCritterData(centerA, wanderA, 50, 'A');
        let orangeCritters = generateCritterData(centerB, wanderB, 50, 'B');
        allCrittersData = [...blueCritters, ...orangeCritters];
        
        const positionedData = positionCritters(allCrittersData);
        renderCritters(positionedData);
        updateMagicFence();
        updateFeedback();
    }

    // --- Controls and Buttons ---
    // Linking sliders to our game variables.
    const controls = {
        'meanA': { value: 'centerA', el: document.getElementById('meanA-value') },
        'spreadA': { value: 'wanderA', el: document.getElementById('spreadA-value') },
        'meanB': { value: 'centerB', el: document.getElementById('meanB-value') },
        'spreadB': { value: 'wanderB', el: document.getElementById('spreadB-value') }
    };

    Object.keys(controls).forEach(id => {
        const slider = document.getElementById(id);
        slider.addEventListener('input', (e) => {
            window[controls[id].value] = +e.target.value; // Nasty global write, but simple for this demo
            controls[id].el.textContent = e.target.value;
            if (id === 'meanA') centerA = +e.target.value;
            if (id === 'spreadA') wanderA = +e.target.value;
            if (id === 'meanB') centerB = +e.target.value;
            if (id === 'spreadB') spreadB = +e.target.value;
            resetGuess();
            updateGame();
        });
    });
    
    // -- Scenario Buttons --
    document.getElementById('easy-separation').addEventListener('click', () => {
        centerA = 5; wanderA = 2; centerB = 25; wanderB = 2;
        updateControlsUI();
    });
    document.getElementById('tricky-overlap').addEventListener('click', () => {
        centerA = 12; wanderA = 6; centerB = 18; wanderB = 6;
        updateControlsUI();
    });
     document.getElementById('unbalanced-problem').addEventListener('click', () => {
        // We'll regenerate data directly for this one
        let blueCritters = generateCritterData(8, 4, 80, 'A'); // Lots of blue
        let orangeCritters = generateCritterData(22, 3, 20, 'B'); // Few orange
        allCrittersData = [...blueCritters, ...orangeCritters];
        
        const positionedData = positionCritters(allCrittersData);
        renderCritters(positionedData);
        updateFeedback();
    });

    function updateControlsUI() {
        document.getElementById('meanA').value = centerA;
        document.getElementById('meanA-value').textContent = centerA;
        document.getElementById('spreadA').value = wanderA;
        document.getElementById('spreadA-value').textContent = wanderA;
        document.getElementById('meanB').value = centerB;
        document.getElementById('meanB-value').textContent = centerB;
        document.getElementById('spreadB').value = spreadB;
        document.getElementById('spreadB-value').textContent = spreadB;
        resetGuess();
        updateGame();
    }

    // -- Guess & Compare Buttons --
    document.getElementById('lock-guess').addEventListener('click', function() {
        guessLocked = !guessLocked;
        this.textContent = guessLocked ? "Change Guess" : "Lock Guess";
        this.classList.toggle('active', guessLocked);
        
        if (guessLocked) {
            const fenceX = xScale(magicFencePosition);
            lockedGuessLine = svg.append('line')
                .attr('class', 'locked-guess-line')
                .attr('x1', fenceX).attr('x2', fenceX)
                .attr('y1', PADDING_TOP).attr('y2', height - 30);
        } else {
           if (lockedGuessLine) lockedGuessLine.remove();
        }
        updateMagicFence();
    });

    document.getElementById('show-optimal').addEventListener('click', function() {
        // Find the best possible fence position
        let bestScore = 0;
        let bestPosition = 0;
        for (let i = X_RANGE[0]; i <= X_RANGE[1]; i++) {
            const score = calculateScore(allCrittersData, i);
            if (score.accuracy > bestScore) {
                bestScore = score.accuracy;
                bestPosition = i;
            }
        }
        
        // Remove old optimal line if it exists
        if (optimalLine) optimalLine.remove();

        // Draw the new optimal line
        const fenceX = xScale(bestPosition);
        optimalLine = svg.append('line')
            .attr('class', 'optimal-line')
            .attr('x1', fenceX).attr('x2', fenceX)
            .attr('y1', PADDING_TOP).attr('y2', height - 30);
    });

    function resetGuess() {
        guessLocked = false;
        const lockButton = document.getElementById('lock-guess');
        lockButton.textContent = "Lock Guess";
        lockButton.classList.remove('active');
        if (lockedGuessLine) lockedGuessLine.remove();
        if (optimalLine) optimalLine.remove();
        updateMagicFence();
    }

    // --- Initial Game Load ---
    updateControlsUI();
});