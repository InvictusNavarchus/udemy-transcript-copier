// ==UserScript==
// @name         Udemy Transcript Copier
// @namespace    http://tampermonkey.net/
// @version      0.2.0
// @description  Adds a button to copy the entire course transcript on Udemy.
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
     * Handles the copy to clipboard action and provides user feedback.
     * @param {HTMLButtonElement} button - The button that was clicked.
     */
    async function handleCopyClick(button) {
        console.log(getPrefix(), 'Copy button clicked.');

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

        const transcriptText = Array.from(textElements)
            .map(el => el.textContent.trim())
            .join('\n'); // Join with a newline for proper formatting.

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

