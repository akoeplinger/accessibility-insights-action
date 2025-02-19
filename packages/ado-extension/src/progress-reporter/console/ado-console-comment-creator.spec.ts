// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import 'reflect-metadata';

import { Mock, Times, IMock, MockBehavior } from 'typemoq';
import { AdoConsoleCommentCreator } from './ado-console-comment-creator';
import { ADOTaskConfig } from '../../task-config/ado-task-config';
import { CombinedReportParameters } from 'accessibility-insights-report';
import * as fs from 'fs';
import * as path from 'path';

import { RecordingTestLogger, ReportConsoleLogConvertor, ReportMarkdownConvertor } from '@accessibility-insights-action/shared';

/* eslint-disable @typescript-eslint/restrict-template-expressions */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */

describe(AdoConsoleCommentCreator, () => {
    let adoTaskConfigMock: IMock<ADOTaskConfig>;
    let logger: RecordingTestLogger;
    let reportMarkdownConvertorMock: IMock<ReportMarkdownConvertor>;
    let reportConsoleLogConvertorMock: IMock<ReportConsoleLogConvertor>;
    let testSubject: AdoConsoleCommentCreator;
    let fsMock: IMock<typeof fs>;
    let pathStub: typeof path;

    const defaultReportOutDir = 'reportOutDir';
    const reportStub: CombinedReportParameters = {
        results: {
            urlResults: {
                failedUrls: 1,
            },
        },
    } as CombinedReportParameters;
    const baselineInfoStub = {};
    const reportMarkdownStub = '#ReportMarkdownStub';
    const reportConsoleLogStub = 'Report Console Log Stub';

    beforeEach(() => {
        adoTaskConfigMock = Mock.ofType<ADOTaskConfig>();
        logger = new RecordingTestLogger();
        reportMarkdownConvertorMock = Mock.ofType<ReportMarkdownConvertor>(undefined, MockBehavior.Strict);
        reportConsoleLogConvertorMock = Mock.ofType<ReportConsoleLogConvertor>(undefined, MockBehavior.Strict);
        fsMock = Mock.ofType<typeof fs>();
        pathStub = { join: (...paths) => paths.join('/') } as typeof path;

        reportMarkdownConvertorMock
            .setup((o) => o.convert(reportStub, undefined, baselineInfoStub))
            .returns(() => reportMarkdownStub)
            .verifiable(Times.atMostOnce());

        reportConsoleLogConvertorMock
            .setup((o) => o.convert(reportStub, undefined, baselineInfoStub))
            .returns(() => reportConsoleLogStub)
            .verifiable(Times.atMostOnce());

        testSubject = new AdoConsoleCommentCreator(
            adoTaskConfigMock.object,
            reportMarkdownConvertorMock.object,
            reportConsoleLogConvertorMock.object,
            logger,
            fsMock.object,
            pathStub,
        );
    });

    describe('completeRun', () => {
        it.each`
            uploadOutputArtifact | outputArtifactName         | jobAttempt | expectedSummaryFilePath
            ${false}             | ${'accessibility-reports'} | ${1}       | ${'reportOutDir/Accessibility Insights scan summary.md'}
            ${false}             | ${'custom-artifact'}       | ${1}       | ${'reportOutDir/Accessibility Insights scan summary.md'}
            ${false}             | ${'accessibility-reports'} | ${2}       | ${'reportOutDir/Accessibility Insights scan summary.md'}
            ${true}              | ${'accessibility-reports'} | ${1}       | ${'reportOutDir/Accessibility Insights scan summary.md'}
            ${true}              | ${'custom-artifact'}       | ${1}       | ${'reportOutDir/Accessibility Insights scan summary (custom-artifact).md'}
            ${true}              | ${'accessibility-reports'} | ${2}       | ${'reportOutDir/Accessibility Insights scan summary (accessibility-reports-2).md'}
        `(
            'should create and upload a job summary with the expected filename for inputs uploadOutputArtifact=$uploadOutputArtifact, outputArtifactName=$outputArtifactName, jobAttempt=$jobAttempt',
            async ({ uploadOutputArtifact, outputArtifactName, jobAttempt, expectedSummaryFilePath }) => {
                setupTaskConfig({
                    uploadOutputArtifact,
                    outputArtifactName,
                    jobAttempt,
                });

                // eslint-disable-next-line security/detect-non-literal-fs-filename
                fsMock.setup((fsm) => fsm.writeFileSync(expectedSummaryFilePath, reportMarkdownStub)).verifiable(Times.once());

                await testSubject.completeRun(reportStub);

                expect(logger.recordedLogs()).toContain(`[info] ##vso[task.uploadsummary]${expectedSummaryFilePath}`);
                verifyAllMocks();
            },
        );

        it.each`
            outputArtifactName         | jobAttempt | expectedArtifactName
            ${'accessibility-reports'} | ${1}       | ${'accessibility-reports'}
            ${'custom-artifact'}       | ${1}       | ${'custom-artifact'}
            ${'accessibility-reports'} | ${2}       | ${'accessibility-reports-2'}
            ${'custom-artifact'}       | ${2}       | ${'custom-artifact-2'}
        `(
            'should upload an artifact with the expected name for inputs uploadOutputArtifact=true, outputArtifactName=$outputArtifactName, jobAttempt=$jobAttempt',
            async ({ outputArtifactName, jobAttempt, expectedArtifactName }) => {
                setupTaskConfig({
                    uploadOutputArtifact: true,
                    outputArtifactName,
                    jobAttempt,
                });

                await testSubject.completeRun(reportStub);

                expect(logger.recordedLogs()).toContain(
                    `[info] ##vso[artifact.upload artifactname=${expectedArtifactName}]${defaultReportOutDir}`,
                );
                verifyAllMocks();
            },
        );

        it.each`
            outputArtifactName         | jobAttempt
            ${'accessibility-reports'} | ${1}
            ${'custom-artifact'}       | ${1}
            ${'accessibility-reports'} | ${2}
            ${'custom-artifact'}       | ${2}
        `(
            'should not upload an artifact inputs uploadOutputArtifact=false, outputArtifactName=$outputArtifactName, jobAttempt=$jobAttempt',
            async ({ outputArtifactName, jobAttempt }) => {
                setupTaskConfig({
                    uploadOutputArtifact: false,
                    outputArtifactName,
                    jobAttempt,
                });

                await testSubject.completeRun(reportStub);

                expect(logger.recordedLogs()).not.toContain(/##vso\[artifact.upload/);
                verifyAllMocks();
            },
        );
    });

    describe('failRun', () => {
        it('does nothing interesting', async () => {
            await testSubject.failRun();

            expect(logger.recordedLogs()).toStrictEqual([]);
            verifyAllMocks();
        });
    });

    describe('didScanSucceed', () => {
        it('returns true by default', async () => {
            await expect(testSubject.didScanSucceed()).resolves.toBe(true);

            verifyAllMocks();
        });

        it('returns true after failRun() is called', async () => {
            await testSubject.failRun();

            await expect(testSubject.didScanSucceed()).resolves.toBe(true);

            verifyAllMocks();
        });
    });

    function setupTaskConfig(config: {
        uploadOutputArtifact: boolean;
        outputArtifactName: string;
        jobAttempt: number;
        baselineFile?: string;
        reportOutDir?: string;
    }): void {
        adoTaskConfigMock.setup((atcm) => atcm.getUploadOutputArtifact()).returns(() => config.uploadOutputArtifact);

        adoTaskConfigMock.setup((atcm) => atcm.getVariable('System.JobAttempt')).returns(() => `${config.jobAttempt}`);

        adoTaskConfigMock.setup((atcm) => atcm.getOutputArtifactName()).returns(() => config.outputArtifactName);

        adoTaskConfigMock.setup((atcm) => atcm.getBaselineFile()).returns(() => config.baselineFile);

        adoTaskConfigMock.setup((atcm) => atcm.getReportOutDir()).returns(() => config.reportOutDir ?? defaultReportOutDir);
    }

    const verifyAllMocks = () => {
        adoTaskConfigMock.verifyAll();
        reportMarkdownConvertorMock.verifyAll();
        reportConsoleLogConvertorMock.verifyAll();
        fsMock.verifyAll();
    };
});
