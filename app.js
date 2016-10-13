const [UP, DOWN, LEFT, RIGHT] = [0, 1, 2, 3];
const raf = window.requestAnimationFrame ||
  window.mozRequestAnimationFrame ||
  window.webkitRequestAnimationFrame ||
  window.msRequestAnimationFrame ||
  window.oRequestAnimationFrame;

const state = {
  rows: 50,
  columns: 50,
  width: 500,
  height: 500,
  animated: false,
  biases: [0.25, 0.25, 0.25, 0.25],
  entrance: randomOpening(50, 50),
  exit: randomOpening(50, 50),
  showingSolution: false,
  solution: null,
  path: [],
  get cellWidth() {
    return this.width / this.columns;
  },
  get cellHeight() {
    return this.height / this.rows;
  }
};

const canvas = document.getElementById("canvas");
const offscreen = document.createElement("canvas");
const ctx = canvas.getContext("2d");
const octx = offscreen.getContext("2d");

/* UI Elements */
const rowInput = getEl("row-input");
const columnInput = getEl("column-input");
const widthInput = getEl("width-input");
const heightInput = getEl("height-input");
const upBiasInput = getEl("up-bias-input");
const downBiasInput = getEl("down-bias-input");
const leftBiasInput = getEl("left-bias-input");
const rightBiasInput = getEl("right-bias-input");
const animStepsCheckbox = getEl("animate-steps-checkbox");
const showSolutionCheckbox = getEl("show-solution-checkbox");
const clearLineBtn = getEl("clear-line-btn");
const form = getEl("maze-gen-settings");

let dirty = false;
let mouseDown = false;
let disposable;

// Initialize UI
rowInput.value = state.rows;
columnInput.value = state.columns;
widthInput.value = offscreen.width = canvas.width = state.width;
heightInput.value = offscreen.height = canvas.height = state.height;
upBiasInput.value = state.biases[0];
downBiasInput.value = state.biases[1];
leftBiasInput.value = state.biases[2];
rightBiasInput.value = state.biases[3];
animStepsCheckbox.checked = !!state.animated;
showSolutionCheckbox.checked = !!state.showingSolution;
showSolutionCheckbox.disabled = !!state.animated;
//

form.addEventListener("submit", (e) => {
  e.preventDefault();
  if(disposable) {
    disposable.dispose();
  }
  updateAppState();
  disposable = buildMaze();
});

window.addEventListener("mousedown", () => {
  mouseDown = true;
});

window.addEventListener("mouseup", () => {
  mouseDown = false;
});

canvas.addEventListener("mousemove", (e) => {
  if(!mouseDown || !state.cells) return;
  const lastStep = last(state.path);
  const mousePos = getMousePos(canvas, e);
  const cell = getNearestCell(state.cells, e);
  if(!cell) return;
  if(!lastStep) {
    state.path.push({cell, connectCell: null});
  } else {
    const connectStep = state.path.find((other) => other.cell !== cell && canTraverse(other.cell, cell));
    if(connectStep && !state.path.some((other) => other.cell === cell)) {
      state.path.push({cell, connectCell: connectStep.cell});
      dirty = true;
    }
  }
});

widthInput.addEventListener("change", () => {
  state.width = canvas.width = offscreen.width = parseInt(widthInput.value);
  dirty = true;
});

heightInput.addEventListener("change", () => {
  state.height = canvas.height = offscreen.height = parseInt(heightInput.value);
  dirty = true;
});

clearLineBtn.addEventListener("click", (e) => {
  e.preventDefault();
  state.path = [];
  dirty = true;
});

showSolutionCheckbox.addEventListener("change", () => {
  const showingSolution = state.showingSolution = !!showSolutionCheckbox.checked;
  dirty = true;
});

disposable = buildMaze();
raf(draw);

function draw() {
  const {cells, showingSolution, path, width, height, rows, columns, cellWidth, cellHeight, animated, biases} = state;
  let {solution} = state;
  const getX = (x) => cellWidth * x;
  const getY = (y) => cellHeight * y;
  if(!dirty || !cells) {
    raf(draw);
    return;
  }
  dirty = false;

  octx.fillStyle = "#888888";
  octx.fillRect(0, 0, width, height);
  cells.forEach((cell) => {
    const {x, y, walls, visitCount, dead} = cell;
    const [up, down, left, right] = walls;
    const cx = getX(x);
    const cy = getY(y);
    state.cells = cells;

    octx.fillStyle = dead ? "rgb(255, 255, 255)" : "rgb(180, 180, 255)";
    octx.fillRect(cx, cy, cellWidth, cellHeight);
    if(up) {
      line(octx, cx, cy, cx + cellWidth, cy);
    }
    if(down) {
      line(octx, cx, cy + cellHeight, cx + cellWidth, cy + cellHeight);
    }
    if(left) {
      line(octx, cx, cy, cx, cy + cellHeight);
    }
    if(right) {
      line(octx, cx + cellWidth, cy, cx + cellWidth, cy + cellHeight);
    }
  });

  octx.save();
  octx.strokeStyle = "rgba(0, 150, 0, 0.6)";
  const midX = (x) => getX(x) + (cellWidth / 2);
  const midY = (y) => getY(y) + (cellHeight / 2);
  path.forEach(({cell, connectCell}) => {
    if(connectCell) {
      octx.moveTo(midX(connectCell.x), midY(connectCell.y));
      octx.lineTo(midX(cell.x), midY(cell.y));
      octx.stroke();
    } else {
      octx.moveTo(midX(cell.x), midY(cell.y));
    }
  });
  octx.stroke();
  octx.restore();

  if(showingSolution && solution && solution.length) {
    octx.save();
    //octx.strokeStyle = "rgb(255, 0, 0)";
    octx.moveTo(midX(solution[0].x), midY(solution[1].y));
    solution.forEach((cell, i) => {
      if(i) {
        octx.lineTo(midX(cell.x), midY(cell.y));
        octx.stroke();
      }
    });
    octx.stroke();
    octx.restore();
  }

  ctx.drawImage(offscreen, 0, 0, width, height);
  raf(draw);
}

function buildMaze() {
  const {width, height, rows, columns, cellWidth, cellHeight, animated, biases} = state;
  const getX = (x) => cellWidth * x;
  const getY = (y) => cellHeight * y;
  state.solution = null;
  return generateMaze({
    rows,
    columns,
    animated,
    selectNeighbor: biasNeighborSelector(biases),
    openings: [state.entrance, state.exit]
  }).subscribe((cells) => {
    dirty = true;
    state.cells = cells;
    state.solution = solveMaze(cells, state.entrance, state.exit);
  },
  (error) => console.error(error),
  () => {
    dirty = true;
  });
};

function solveMaze(cells, entrance, exit) {
  const getCell = ({x, y}) => cells.find((cell) => cell.x === x && cell.y === y);
  const entranceCell = getCell(entrance);
  const exitCell = getCell(exit);
  const visited = [];

  function walk(path, cell) {
    visited.push(cell);

    if(cell === exitCell) {
      return path;
    } else {
      const paths = cell.neighbors.filter((c) => {
        return c && visited.indexOf(c) === -1 && !cell.walls[cell.neighbors.indexOf(c)];
      })
        .map((c) => walk(path.concat(c), c))
        .filter((p) => !!p);
      if(!paths.length) {
        return null;
      } else {
        return paths.reduce((a, b) => a.length < b.length ? a : b);
      }
    }
  }
  if(!entranceCell || !exitCell) {
    return [];
  }
  return walk([entranceCell], entranceCell);
}

function updateAppState() {
  state.rows = parseInt(rowInput.value);
  state.columns = parseInt(columnInput.value);
  state.width = offscreen.width = canvas.width = parseInt(widthInput.value);
  state.height = offscreen.height = canvas.height = parseInt(heightInput.value);
  state.biases = [
    parseFloat(upBiasInput.value),
    parseFloat(downBiasInput.value),
    parseFloat(leftBiasInput.value),
    parseFloat(rightBiasInput.value)
  ];
  state.animated = !!animStepsCheckbox.checked;
  state.path = [];
  state.entrance = randomOpening(state.columns, state.rows);
  state.exit = randomOpening(state.columns, state.rows);
  state.solution = null;
}

function generateMaze({
  columns = 10,
  rows = 10,
  selectNeighbor = defaultSelectNeighbor,
  scheduler = raf,
  animated = false,
  openings = [
    randomOpening(columns, rows),
    randomOpening(columns, rows)
  ]
}={}) {
  return Rx.Observable.create((observer) => {
    const grid = range(rows).map((y) => {
      return range(columns).map((x) => {
        const cell = {
          x, y,
          walls: [true, true, true, true],
          visited: false,
          visitCount: 0,
          dead: false
        };

        openings.forEach((o) => {
          if(o.x === cell.x && o.y === cell.y) {
            cell.walls[o.wall] = false;
          }
        });

        return cell;
      });
    });
    const cells = flatten(grid);
    const getCell = (x, y) => grid[y] ? grid[y][x] : null;
    const firstCell = sample(cells);
    const cellStack = [firstCell];
    const visited = [firstCell];
    const visit = (parent, child) => {
      child.visited = true;
      cellStack.push(child);
      visited.push(child);
      parent.walls[parent.neighbors.indexOf(child)] = false;
      child.walls[child.neighbors.indexOf(parent)] = false;
      if(animated) {
        observer.onNext(visited);
      }
    };
    let running = true;
    firstCell.visited = true;
    firstCell.visitCount = 1;

    cells.forEach((cell) => {
      cell.neighbors = [
        getCell(cell.x, cell.y - 1),
        getCell(cell.x, cell.y + 1),
        getCell(cell.x - 1, cell.y),
        getCell(cell.x + 1, cell.y)
      ];
    });

    const step = () => {
      if(!running) return;
      if(cellStack.length) {
        let parent = last(cellStack);
        let child = selectNeighbor(parent);
        do {
          parent = last(cellStack);
          child = selectNeighbor(parent);
          if(!child) {
            parent.dead = true;
            cellStack.pop();
          }
        } while(!child && cellStack.length);

        if(child) {
          visit(parent, child);
        }
        if(animated) {
          scheduler(step);
        }
      } else {
        running = false;
        observer.onNext(visited);
        observer.onCompleted(visited);
      }
    };

    if(animated) {
      scheduler(step);
    } else {
      while(cellStack.length) {
        step();
      }
      observer.onNext(visited);
    }
    return () => {
      running = false;
    };
  });
}

// utility functions
function getMousePos(canvas, event) {
  var rect = canvas.getBoundingClientRect();
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top
  };
}

function getNearestCell(cells, e) {
  const mouse = getMousePos(canvas, e);
  const x = Math.floor(mouse.x / state.cellWidth);
  const y = Math.floor(mouse.y / state.cellHeight);

  return cells.find((cell) => {
    return cell.x === x && cell.y === y;
  });
}

function canTraverse(cellA, cellB) {
  const direction = cellA.neighbors.indexOf(cellB);
  return cellA === cellB || direction !== -1 && !cellA.walls[direction];
}

function getEl(className) {
  return document.getElementsByClassName(className)[0];
}

function range(n) {
  const r = [];
  for(var i = 0; i < n; i++) {
    r.push(i);
  }
  return r;
}

function sample(arr){
  return arr[Math.floor(Math.random() * arr.length)];
}

function flatten(arr) {
  return arr.reduce((flatArr, v) => flatArr.concat(v), []);
}

function last(a) {
  return a[a.length - 1];
}

function canVisit(n) {
  return n && !n.visited;
}

function defaultSelectNeighbor(cell) {
  return sample(cell.neighbors.filter(canVisit));
}

function line(ctx, x1, y1, x2, y2) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

function randInt(top) {
  return Math.floor(Math.random() * top);
}

function randomOpening(width, height) {
  const wallSeed = Math.random();
  if(wallSeed <= 0.25) { // top
    return {x: randInt(width), y: 0, wall: UP};
  } else if(wallSeed <= 0.5) { // bottom
    return {x: randInt(width), y: height - 1, wall: DOWN};
  } else if(wallSeed <= 0.75) { // left
    return {x: 0, y: randInt(height), wall: LEFT};
  } else { // right
    return {x: width - 1, y: randInt(height), wall: RIGHT};
  }
}

function biasNeighborSelector([upBias, downBias, leftBias, rightBias]) {
  return (cell) => {
    const {neighbors} = cell;
    const r = Math.random();
    if(r < upBias && canVisit(neighbors[UP])) {
      return neighbors[UP];
    } else if(r < (upBias + downBias) && canVisit(neighbors[DOWN])) {
      return neighbors[DOWN];
    } else if(r < (upBias + downBias + leftBias) && canVisit(neighbors[LEFT])) {
      return neighbors[LEFT];
    } else if(canVisit(neighbors[RIGHT])) {
      return neighbors[RIGHT];
    }
    return defaultSelectNeighbor(cell);
  };
}
