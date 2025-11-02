// ==UserScript==
// @name         Udemy Transcript Copier
// @namespace    http://tampermonkey.net/
// @version      0.5.0
// @description  Adds a button to copy the entire course transcript and metadata on Udemy, with configurable settings.
// @author       You
// @match        https://*.udemy.com/course/*
// @grant        GM_setValue
// @grant        GM_getValue
// @license      MIT
// ==/UserScript==

(function() {
    'use strict';

    // --- 1. Robust Logging System ---
    const SCRIPT_PREFIX = '[Udemy Transcript Copier]:';
    /**
     * Prepends the script prefix to log messages.
     * @returns {string} The prefix.
     */
    function getPrefix() {
        return SCRIPT_PREFIX;
    }
    console.log(getPrefix(), 'Script starting up.');

    // --- 2. Settings Management ---
    const SETTINGS_KEY = 'udemyTranscriptSettings';

    // Default settings structure
    const DEFAULT_SETTINGS = {
        includeCourseTitle: true,
        includeCourseSubtitle: true,
        includeSectionLecture: true,
        includeInstructors: true,
        includeRating: true,
        includeLength: true,
        includeLastUpdated: true,
        includeCaptions: true,
        includeLanguage: true,
    };

    let userSettings = { ...DEFAULT_SETTINGS };

    /**
     * Loads settings from Tampermonkey storage or uses defaults.
     */
    async function loadSettings() {
        const storedSettings = await GM_getValue(SETTINGS_KEY, JSON.stringify(DEFAULT_SETTINGS));
        try {
            const parsed = JSON.parse(storedSettings);
            // Merge defaults with parsed to ensure new settings are added
            userSettings = { ...DEFAULT_SETTINGS, ...parsed };
            console.log(getPrefix(), 'Settings loaded:', userSettings);
        } catch (e) {
            console.error(getPrefix(), 'Error parsing stored settings. Using defaults.', e);
            userSettings = { ...DEFAULT_SETTINGS };
        }
    }

    /**
     * Saves the current settings to Tampermonkey storage.
     */
    async function saveSettings() {
        const panel = document.getElementById('utc-settings-panel');
        if (!panel) return;

        // Update userSettings from checkboxes
        for (const key in DEFAULT_SETTINGS) {
            const checkbox = panel.querySelector(`input[name="${key}"]`);
            if (checkbox) {
                userSettings[key] = checkbox.checked;
            }
        }

        await GM_setValue(SETTINGS_KEY, JSON.stringify(userSettings));
        console.log(getPrefix(), 'Settings saved:', userSettings);

        // Show a brief "Saved!" message
        const saveBtn = panel.querySelector('#utc-save-settings');
        if (saveBtn) {
            saveBtn.textContent = 'Saved!';
            setTimeout(() => {
                saveBtn.textContent = 'Save Settings';
            }, 1500);
        }
    }

    /**
     * Creates the HTML for the settings panel.
     * @returns {HTMLElement} The settings panel element.
     */
    function createSettingsPanel() {
        const panel = document.createElement('div');
        panel.id = 'utc-settings-panel';
        panel.style.display = 'none'; // Hidden by default
        panel.style.padding = '16px';
        panel.style.border = '1px solid #d1d7dc';
        panel.style.borderRadius = '4px';
        panel.style.marginBottom = '10px';
        panel.style.backgroundColor = '#f7f9fa';

        panel.innerHTML = `
            <h4 class="ud-heading-md" style="margin-bottom: 15px;">Metadata to Include</h4>
            <div id="utc-settings-list" style="display: flex; flex-direction: column; gap: 10px;">
                <!-- Checkboxes will be injected here by loadSettingsToUI -->
            </div>
            <div style="display: flex; gap: 10px; margin-top: 15px;">
                <button id="utc-save-settings" class="ud-btn ud-btn-small ud-btn-primary">Save Settings</button>
                <button id="utc-close-settings" class="ud-btn ud-btn-small ud-btn-secondary">Close</button>
            </div>
        `;

        // Add event listeners
        panel.querySelector('#utc-save-settings').addEventListener('click', saveSettings);
        panel.querySelector('#utc-close-settings').addEventListener('click', () => {
            panel.style.display = 'none';
        });

        loadSettingsToUI(panel.querySelector('#utc-settings-list'));
        return panel;
    }

    /**
     * Populates the settings panel with checkboxes based on userSettings.
     * @param {HTMLElement} listElement - The element to inject checkboxes into.
     */
    function loadSettingsToUI(listElement) {
        if (!listElement) return;

        const labels = {
            includeCourseTitle: 'Course Title',
            includeCourseSubtitle: 'Course Subtitle',
            includeSectionLecture: 'Section & Lecture Title',
            includeInstructors: 'Instructors',
            includeRating: 'Rating & Reviews',
            includeLength: 'Total Length',
            includeLastUpdated: 'Last Updated Date',
            includeCaptions: 'Caption Languages',
            includeLanguage: 'Course Language',
        };

        let checkboxesHTML = '';
        for (const key in userSettings) {
            const label = labels[key] || key;
            const checked = userSettings[key] ? 'checked' : '';
            checkboxesHTML += `
                <label class="ud-toggle-input-container ud-text-sm">
                    <input type="checkbox" class="ud-real-toggle-input" name="${key}" ${checked}>
                    <svg aria-hidden="true" focusable="false" class="ud-icon ud-icon-xsmall ud-fake-toggle-input ud-fake-toggle-checkbox">
                        <use xlink:href="#icon-tick"></use>
                    </svg>
                    <span>${label}</span>
                </label>
            `;
        }
        listElement.innerHTML = checkboxesHTML;
    }

    /**
     * Toggles the visibility of the settings panel.
     */
    function toggleSettingsPanel() {
        const panel = document.getElementById('utc-settings-panel');
        if (panel) {
            const isHidden = panel.style.display === 'none';
            panel.style.display = isHidden ? 'block' : 'none';
            if (isHidden) {
                // Re-load settings into UI in case they were changed elsewhere
                loadSettingsToUI(panel.querySelector('#utc-settings-list'));
            }
        }
    }


    // --- 3. Core Functionality ---

    /**
     * Finds and parses the course data JSON blob from the page's HTML.
     * @returns {object | null} The parsed course data or null if not found.
     */
    function getCourseData() {
        console.log(getPrefix(), 'Attempting to find course data JSON blob...');
        const dataEl = document.querySelector('.ud-app-loader[data-module-args]');
        if (!dataEl || !dataEl.dataset.moduleArgs) {
            console.error(getPrefix(), 'Could not find the data-module-args element.');
            return null;
        }

        try {
            const data = JSON.parse(dataEl.dataset.moduleArgs);
            console.log(getPrefix(), 'Successfully parsed course data.');
            return data;
        } catch (e) {
            console.error(getPrefix(), 'Failed to parse course data JSON:', e);
            return null;
        }
    }

    /**
     * Handles the copy to clipboard action and provides user feedback.
     * @param {HTMLButtonElement} button - The button that was clicked.
     */
    async function handleCopyClick(button) {
        console.log(getPrefix(), 'Copy button clicked.');
        let headerLines = [];

        // 1. Get Data from JSON Blob
        const courseData = getCourseData();
        if (courseData) {
            try {
                // Course Title (from DOM, as it's not in the JSON)
                if (userSettings.includeCourseTitle) {
                    const courseTitleEl = document.querySelector('span.curriculum-item-view--course-title--s5jCa');
                    if (courseTitleEl) {
                        headerLines.push(`# ${courseTitleEl.textContent.trim()}`);
                    }
                }

                // Course Subtitle (from DOM)
                if (userSettings.includeCourseSubtitle) {
                    const courseSubtitleEl = document.querySelector('div[data-purpose="title"]');
                    if (courseSubtitleEl) {
                        headerLines.push(`## *${courseSubtitleEl.textContent.trim()}*`);
                    }
                }
                
                if (headerLines.length > 0) headerLines.push('---');

                // 2. Get Current Section and Lecture Info (from DOM)
                if (userSettings.includeSectionLecture) {
                    const lectureTitleEl = document.querySelector('li[aria-current="true"] span[data-purpose="item-title"]');
                    const currentLectureItem = document.querySelector('li[aria-current="true"]');
                    const sectionPanel = currentLectureItem ? currentLectureItem.closest('div[data-purpose*="section-panel-"]') : null;
                    const sectionTitleEl = sectionPanel ? sectionPanel.querySelector('span.ud-accordion-panel-title > span') : null;

                    const lectureTitle = lectureTitleEl ? lectureTitleEl.textContent.trim() : 'Unknown Lecture';
                    const sectionTitle = sectionTitleEl ? sectionTitleEl.textContent.trim() : 'Unknown Section';
                    headerLines.push(`**Section:** ${sectionTitle}`);
                    headerLines.push(`**Lecture:** ${lectureTitle}`);
                    headerLines.push('---');
                }

                // 3. Get Metadata from JSON
                let detailsLines = [];
                
                // Instructors
                if (userSettings.includeInstructors && courseData.instructorInfo && courseData.instructorInfo.instructors_info) {
                    const instructors = courseData.instructorInfo.instructors_info
                        .map(inst => `${inst.title} (${inst.job_title})`)
                        .join(', ');
                    detailsLines.push(`* **Instructors:** ${instructors}`);
                }

                // Course Stats from courseLeadData
                if (courseData.courseLeadData) {
                    const leadData = courseData.courseLeadData;
                    if (userSettings.includeRating) {
                        const rating = leadData.rating ? leadData.rating.toFixed(2) : 'N/A';
                        const reviews = leadData.num_reviews ? leadData.num_reviews.toLocaleString() : 'N/A';
                        detailsLines.push(`* **Rating:** ${rating} (${reviews} reviews)`);
                    }
                    if (userSettings.includeLength && leadData.content_info_short) {
                        detailsLines.push(`* **Total Length:** ${leadData.content_info_short}`);
                    }
                    if (userSettings.includeLastUpdated && leadData.last_update_date) {
                        detailsLines.push(`* **Last Updated:** ${leadData.last_update_date}`);
                    }
                    if (userSettings.includeCaptions && leadData.captionedLanguages && leadData.captionedLanguages.length > 0) {
                        detailsLines.push(`* **Captions:** ${leadData.captionedLanguages.join(', ')}`);
                    }
                }
                
                // Language (from DOM)
                if (userSettings.includeLanguage) {
                    const langEl = document.querySelector('div[data-purpose="language"] .course-lead--caption---JHbX');
                    if (langEl) {
                        const langText = Array.from(langEl.childNodes)
                            .filter(node => node.nodeType === Node.TEXT_NODE)
                            .map(node => node.textContent.trim())
                            .join('');
                        if (langText) {
                            detailsLines.push(`* **Language:** ${langText}`);
                        }
                    }
                }

                if (detailsLines.length > 0) {
                    headerLines.push('**Course Details:**');
                    headerLines.push(...detailsLines);
                    headerLines.push('---');
                }
                
                headerLines.push('## Transcript\n'); // Add extra newline for spacing

            } catch (e) {
                console.error(getPrefix(), 'Failed to build metadata header:', e);
                headerLines = []; // Clear header on error to avoid partial data
            }
        } else {
            console.warn(getPrefix(), 'Could not parse course data. Falling back to simple Section/Lecture titles.');
            // Fallback to old method if JSON fails
            if (userSettings.includeSectionLecture) {
                const lectureTitleEl = document.querySelector('li[aria-current="true"] span[data-purpose="item-title"]');
                const currentLectureItem = document.querySelector('li[aria-current="true"]');
                const sectionPanel = currentLectureItem ? currentLectureItem.closest('div[data-purpose*="section-panel-"]') : null;
                const sectionTitleEl = sectionPanel ? sectionPanel.querySelector('span.ud-accordion-panel-title > span') : null;

                const lectureTitle = lectureTitleEl ? lectureTitleEl.textContent.trim() : 'Unknown Lecture';
                const sectionTitle = sectionTitleEl ? sectionTitleEl.textContent.trim() : 'Unknown Section';
                headerLines.push(`# ${sectionTitle}`);
                headerLines.push(`## ${lectureTitle}\n`);
            }
        }

        // 4. Get Transcript Text (from DOM)
        const transcriptPanel = document.querySelector('div[data-purpose="transcript-panel"]');
        if (!transcriptPanel) {
            console.error(getPrefix(), 'Transcript panel not found.');
            button.textContent = 'Error: Panel not found';
            setTimeout(() => { button.textContent = 'Copy Transcript'; }, 3000);
            return;
        }

        const textElements = transcriptPanel.querySelectorAll('span[data-purpose="cue-text"]');
        if (textElements.length === 0) {
            console.warn(getPrefix(), 'No transcript text found to copy.');
            button.textContent = 'No text found';
            setTimeout(() => { button.textContent = 'Copy Transcript'; }, 3000);
            return;
        }
        console.log(getPrefix(), `Found ${textElements.length} transcript lines to copy.`);

        // 5. Format the final text
        const header = headerLines.join('\n');
        const transcriptLines = Array.from(textElements)
            .map(el => el.textContent.trim())
            .join('\n'); // Join with a newline for proper formatting.
        
        const transcriptText = header + transcriptLines;

        try {
            await navigator.clipboard.writeText(transcriptText);
            console.log(getPrefix(), 'Transcript copied to clipboard!');
            button.textContent = 'Copied!';
        } catch (err) {
            console.error(getPrefix(), 'Failed to copy text: ', err);
            button.textContent = 'Copy Failed!';
            // Fallback for older browsers or if navigator.clipboard fails
            try {
                document.execCommand('copy');
                console.log(getPrefix(), 'Transcript copied via execCommand.');
                button.textContent = 'Copied!';
            } catch (e) {
                console.error(getPrefix(), 'execCommand fallback also failed: ', e);
                button.textContent = 'Copy Failed!';
            }
        }

        setTimeout(() => {
            button.textContent = 'Copy Transcript';
        }, 2000);
    }

    /**
     * Injects the Copy and Settings buttons and the Settings Panel into the page.
     * @param {HTMLElement} transcriptContent - The sidebar content element to prepend to.
     */
    function injectUI(transcriptContent) {
        if (document.getElementById('utc-ui-container')) {
            console.log(getPrefix(), 'UI already injected.');
            return;
        }
        console.log(getPrefix(), 'Injecting UI...');

        const uiContainer = document.createElement('div');
        uiContainer.id = 'utc-ui-container';
        uiContainer.style.padding = '10px 16px 0 16px';
        
        // 1. Create and add Settings Panel (hidden)
        const settingsPanel = createSettingsPanel();
        uiContainer.appendChild(settingsPanel);

        // 2. Create button container
        const buttonContainer = document.createElement('div');
        buttonContainer.style.display = 'flex';
        buttonContainer.style.gap = '10px';
        buttonContainer.style.marginBottom = '10px';

        // 3. Create Copy Button
        const copyButton = document.createElement('button');
        copyButton.id = 'custom-copy-transcript-btn';
        copyButton.textContent = 'Copy Transcript';
        copyButton.className = 'ud-btn ud-btn-medium ud-btn-secondary';
        copyButton.style.flexGrow = '1';
        copyButton.addEventListener('click', () => handleCopyClick(copyButton));
        buttonContainer.appendChild(copyButton);

        // 4. Create Settings Button
        const settingsButton = document.createElement('button');
        settingsButton.id = 'custom-transcript-settings-btn';
        settingsButton.innerHTML = `<svg aria-hidden="true" focusable="false" class="ud-icon ud-icon-medium"><use xlink:href="#icon-settings"></use></svg>`;
        settingsButton.className = 'ud-btn ud-btn-medium ud-btn-ghost';
        settingsButton.style.minWidth = 'auto'; // Shrink to fit icon
        settingsButton.addEventListener('click', toggleSettingsPanel);
        buttonContainer.appendChild(settingsButton);

        // Add button container to main UI container
        uiContainer.appendChild(buttonContainer);
        
        // Add the UI container to the page
        transcriptContent.prepend(uiContainer);
    }

    // --- 4. DOM Observer ---

    /**
     * Watches for the transcript panel to be added to the DOM.
     */
    function initObserver() {
        console.log(getPrefix(), 'Initializing MutationObserver.');
        const observer = new MutationObserver((mutations, obs) => {
            // Use querySelector for a more direct and efficient check
            const transcriptContent = document.querySelector('div[data-purpose="sidebar-content"].sidebar--transcript--D0uuI');
            
            if (transcriptContent) {
                console.log(getPrefix(), 'Transcript panel detected!');
                // Wait for settings to load before injecting UI
                loadSettings().then(() => {
                    injectUI(transcriptContent);
                });
                obs.disconnect(); // Stop observing once found
                console.log(getPrefix(), 'Observer disconnected.');
            }
        });

        // Start observing the document body for added nodes
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    // --- 5. Script Entry Point ---
    // Start the observer. Since Udemy is a SPA, we wait for a load event
    // just in case, but the observer is the main detection mechanism.
    if (document.readyState === 'complete') {
        initObserver();
    } else {
        window.addEventListener('load', initObserver);
    }

})();

