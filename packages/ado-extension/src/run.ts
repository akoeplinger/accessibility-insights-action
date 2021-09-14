// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');

const taskPath = path.join(__dirname, 'index.js');
const tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tmr.setInput('siteDir', '../../../../dev/website-root');
tmr.setInput('scanUrlRelativePath', '/');
tmr.setInput('outputDir', '_accessibility-reports');
tmr.setInput('scanTimeout', '90000');
tmr.setInput('maxUrls', '100');
tmr.run();
