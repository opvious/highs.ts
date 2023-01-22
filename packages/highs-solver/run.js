const addon = require('../highs-solver-addon');

const solver = new addon.Solver('solver.log');
solver.readModel('/Users/mtth/Code/opvious/.test/queens-65.mps');
solver.run();
solver.writeSolution('sol');
