// ==UserScript==
// @name         Udemy Transcript Copier
// @namespace    http://tampermonkey.net/
// @version      0.4.0
// @description  Adds a button to copy the entire course transcript and metadata on Udemy.
// @author       You
// @match        https://*.udemy.com/course/*
// @grant        none
// @license      MIT
// ==/UserScript==

(function() {
    'use strict';

    // --- 1. Robust Logging System ---
    const SCRIPT_TITLE = 'Udemy Transcript Copier';
    const SCRIPT_EMOJI = '📋';

    /**
     * Generates a formatted log prefix with a title, emoji, and timestamp.
     * @returns {string} The formatted log prefix.
     */
    function getPrefix() {
        const now = new Date();
        // HH:mm:ss format
        const timestamp = now.toTimeString().split(' ')[0];
        return `${SCRIPT_EMOJI} ${SCRIPT_TITLE} [${timestamp}]:`;
    }

    console.log(getPrefix(), 'Script starting up.');

    // --- 2. Core Functionality ---

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
                const courseTitleEl = document.querySelector('span.curriculum-item-view--course-title--s5jCa');
                if (courseTitleEl) {
                    headerLines.push(`# ${courseTitleEl.textContent.trim()}`);
                }

                // Course Subtitle (from DOM)
                const courseSubtitleEl = document.querySelector('div[data-purpose="title"]');
                if (courseSubtitleEl) {
                    headerLines.push(`## *${courseSubtitleEl.textContent.trim()}*`);
                }
                headerLines.push('---');

                // 2. Get Current Section and Lecture Info (from DOM)
                const lectureTitleEl = document.querySelector('li[aria-current="true"] span[data-purpose="item-title"]');
                const currentLectureItem = document.querySelector('li[aria-current="true"]');
                const sectionPanel = currentLectureItem ? currentLectureItem.closest('div[data-purpose*="section-panel-"]') : null;
                const sectionTitleEl = sectionPanel ? sectionPanel.querySelector('span.ud-accordion-panel-title > span') : null;

                const lectureTitle = lectureTitleEl ? lectureTitleEl.textContent.trim() : 'Unknown Lecture';
                const sectionTitle = sectionTitleEl ? sectionTitleEl.textContent.trim() : 'Unknown Section';
                headerLines.push(`**Section:** ${sectionTitle}`);
                headerLines.push(`**Lecture:** ${lectureTitle}`);
                headerLines.push('---');

                // 3. Get Metadata from JSON
                headerLines.push('**Course Details:**');
                
                // Instructors
                if (courseData.instructorInfo && courseData.instructorInfo.instructors_info) {
                    const instructors = courseData.instructorInfo.instructors_info
                        .map(inst => `${inst.title} (${inst.job_title})`)
                        .join(', ');
                    headerLines.push(`* **Instructors:** ${instructors}`);
                }

                // Course Stats from courseLeadData
                if (courseData.courseLeadData) {
                    const leadData = courseData.courseLeadData;
                    const rating = leadData.rating ? leadData.rating.toFixed(2) : 'N/A';
                    const reviews = leadData.num_reviews ? leadData.num_reviews.toLocaleString() : 'N/A';
                    headerLines.push(`* **Rating:** ${rating} (${reviews} reviews)`);
                    if (leadData.content_info_short) {
                        headerLines.push(`* **Total Length:** ${leadData.content_info_short}`);
                    }
                    if (leadData.last_update_date) {
                        headerLines.push(`* **Last Updated:** ${leadData.last_update_date}`);
                    }
                    if (leadData.captionedLanguages && leadData.captionedLanguages.length > 0) {
                        headerLines.push(`* **Captions:** ${leadData.captionedLanguages.join(', ')}`);
                    }
                }
                
                // Language (from DOM)
                const langEl = document.querySelector('div[data-purpose="language"] .course-lead--caption---JHbX');
                if (langEl) {
                     // Get only the language text, not the icon text
                    const langText = Array.from(langEl.childNodes)
                        .filter(node => node.nodeType === Node.TEXT_NODE)
                        .map(node => node.textContent.trim())
                        .join('');
                    if(langText) {
                        headerLines.push(`* **Language:** ${langText}`);
                    }
                }

                headerLines.push('---');
                headerLines.push('## Transcript\n'); // Add extra newline for spacing

            } catch (e) {
                console.error(getPrefix(), 'Failed to build metadata header:', e);
                headerLines = []; // Clear header on error to avoid partial data
            }
        } else {
            console.warn(getPrefix(), 'Could not parse course data. Falling back to simple Section/Lecture titles.');
            // Fallback to old method if JSON fails
            const lectureTitleEl = document.querySelector('li[aria-current="true"] span[data-purpose="item-title"]');
            const currentLectureItem = document.querySelector('li[aria-current="true"]');
            const sectionPanel = currentLectureItem ? currentLectureItem.closest('div[data-purpose*="section-panel-"]') : null;
            const sectionTitleEl = sectionPanel ? sectionPanel.querySelector('span.ud-accordion-panel-title > span') : null;

            const lectureTitle = lectureTitleEl ? lectureTitleEl.textContent.trim() : 'Unknown Lecture';
            const sectionTitle = sectionTitleEl ? sectionTitleEl.textContent.trim() : 'Unknown Section';
            headerLines.push(`# ${sectionTitle}`);
            headerLines.push(`## ${lectureTitle}\n`);
        }


        // 4. Get Transcript Text (from DOM)
        const transcriptPanel = document.querySelector('div[data-purpose="transcript-panel"]');
        if (!transcriptPanel) {
            console.error(getPrefix(), 'Transcript panel not found when trying to copy.');
            alert('Could not find the transcript content. Please try again.');
            return;
        }

        const textElements = transcriptPanel.querySelectorAll('span[data-purpose="cue-text"]');
        if (textElements.length === 0) {
            console.warn(getPrefix(), 'No transcript text elements found to copy.');
            alert('No transcript text found to copy.');
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
            console.log(getPrefix(), 'Transcript successfully copied to clipboard.');

            // Provide user feedback
            const originalText = button.textContent;
            button.textContent = 'Copied!';
            button.disabled = true;

            setTimeout(() => {
                button.textContent = originalText;
                button.disabled = false;
                console.log(getPrefix(), 'Button text restored.');
            }, 2000); // Revert after 2 seconds

        } catch (err) {
            console.error(getPrefix(), 'Failed to copy text to clipboard:', err);
            alert('Failed to copy transcript. See the browser console for more details.');
        }
    }


    /**
     * Creates and configures the "Copy Transcript" button.
     * @returns {HTMLButtonElement} The fully configured button element.
     */
    function createCopyButton() {
        console.log(getPrefix(), 'Creating the copy button.');
        const button = document.createElement('button');
        button.id = 'custom-copy-transcript-btn';
        button.textContent = 'Copy Transcript';

        // Apply Udemy's styles to make the button look native
        button.classList.add('ud-btn', 'ud-btn-medium', 'ud-btn-secondary');
        button.style.margin = '10px 16px'; // Add some spacing

        button.addEventListener('click', () => handleCopyClick(button));

        return button;
    }

    /**
     * Injects the copy button onto the page if it doesn't already exist.
     * @param {HTMLElement} transcriptPanel - The detected transcript panel element.
     */
    function injectButton(transcriptPanel) {
        // The best place to inject is right above the transcript content.
        const parentContainer = transcriptPanel.closest('div[data-purpose="sidebar-content"]');

        if (!parentContainer) {
            console.error(getPrefix(), 'Could not find a suitable container to inject the button.');
            return;
        }

        if (parentContainer.querySelector('#custom-copy-transcript-btn')) {
            console.log(getPrefix(), 'Button already exists. Skipping injection.');
            return;
        }

        const button = createCopyButton();
        parentContainer.prepend(button);
        console.log(getPrefix(), 'Copy button injected successfully.');
    }

    // --- 3. DOM Observer for Dynamic Detection ---

    /**
     * Sets up and starts the MutationObserver to watch for the transcript panel.
     */
    function initializeObserver() {
        console.log(getPrefix(), 'Initializing MutationObserver.');
        const observer = new MutationObserver((mutationsList, observer) => {
            for (const mutation of mutationsList) {
                if (mutation.type === 'childList') {
                    const transcriptPanel = document.querySelector('div[data-purpose="transcript-panel"]');
                    if (transcriptPanel) {
                        console.log(getPrefix(), 'Transcript panel detected in the DOM.');
                        injectButton(transcriptPanel);
                        // The panel might be re-rendered, so we don't disconnect.
                        // The injection function has a check to prevent duplicates.
                    }
                }
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        console.log(getPrefix(), 'Observer is now watching for DOM changes.');

        // Initial check in case the transcript panel is already open on page load
        const initialTranscriptPanel = document.querySelector('div[data-purpose="transcript-panel"]');
        if (initialTranscriptPanel) {
            console.log(getPrefix(), 'Transcript panel found on initial page load.');
            injectButton(initialTranscriptPanel);
        }
    }

    // Start the entire process
    initializeObserver();

})();



