// Airtable Script for Unique Slug Generation (Series)
// Tiered Fallback: 1. Computed Slug, 2. + Year, 3. + Numbered Suffix (2, 3, 4...), 4. + Record ID

// --- Configuration ---
const CONFIG = {
    tableName: "Series",
    titleField: "series_title",          // Source for the slug
    computedSlugField: "computed_series_slug", // Formula: basic slug from titleField
    finalSlugField: "series_slug",       // Script writes the unique slug here

    // Optional: Secondary differentiator (e.g., a year)
    secondaryDifferentiatorField: "series_year", // Field name for year, or null if not used
    secondaryDifferentiatorLabel: "year",        // For logging if used

    recordIdSuffixLength: 5,
    maxNumberedSuffix: 10 // How high to count (e.g., -2, -3, ... -10) before Record ID
};

// --- Main Script ---
async function main() {
    console.log(`Script started for Series slug generation.`);

    let inputConfig = input.config();
    let recordId = inputConfig.recordId;

    if (!recordId) {
        console.error("Error: recordId was not provided.");
        output.set("status", "Error: Missing recordId");
        return;
    }
    console.log(`Processing record: ${recordId}`);

    let table = base.getTable(CONFIG.tableName);

    let fieldsToFetch = [
        CONFIG.titleField,
        CONFIG.computedSlugField,
        CONFIG.finalSlugField
    ];
    if (CONFIG.secondaryDifferentiatorField) {
        fieldsToFetch.push(CONFIG.secondaryDifferentiatorField);
    }

    let currentRecordQuery = await table.selectRecordsAsync({
        recordIds: [recordId],
        fields: fieldsToFetch
    });

    if (!currentRecordQuery || currentRecordQuery.records.length === 0) {
        console.error(`Error: Could not find record with ID: ${recordId}`);
        output.set("status", `Error: Record ${recordId} not found`);
        return;
    }

    let record = currentRecordQuery.records[0];
    let seriesTitle = record.getCellValue(CONFIG.titleField);
    let computedSlug = record.getCellValue(CONFIG.computedSlugField); // Slug from formula
    let secondaryDifferentiatorValue = CONFIG.secondaryDifferentiatorField ? record.getCellValue(CONFIG.secondaryDifferentiatorField) : null;

    console.log(`Fetched seriesTitle: "${seriesTitle}"`);
    console.log(`Fetched computedSlug (from formula): "${computedSlug}"`);
    if (CONFIG.secondaryDifferentiatorField && secondaryDifferentiatorValue !== null) {
        console.log(`Fetched ${CONFIG.secondaryDifferentiatorLabel}: "${secondaryDifferentiatorValue}"`);
    }


    if (!seriesTitle || !computedSlug) {
        console.log("Series title or computed slug is empty. Clearing final slug if necessary.");
        let fieldsToClear = {};
        if (record.getCellValue(CONFIG.finalSlugField)) {
            fieldsToClear[CONFIG.finalSlugField] = "";
        }
        if (Object.keys(fieldsToClear).length > 0) {
            await table.updateRecordAsync(recordId, fieldsToClear);
            output.set("status", "Title/computed slug empty; final slug cleared.");
        } else {
            output.set("status", "Title/computed slug empty; final slug already clear.");
        }
        output.set("finalSlugValue", "");
        return;
    }

    // Helper to slugify strings (basic version, computedSlugField should be robust)
    function slugify(text) {
        if (!text) return "";
        return String(text).toLowerCase().trim().replace(/\s+/g, '-').replace(/[^\w-]+/g, '');
    }

    // Fetch all existing final slugs from other records
    let allOtherRecordsQuery = await table.selectRecordsAsync({ fields: [CONFIG.finalSlugField] });
    let existingFinalSlugs = allOtherRecordsQuery.records
        .filter(r => r.id !== recordId) // Exclude current record
        .map(r => r.getCellValue(CONFIG.finalSlugField))
        .filter(s => s); // Remove any empty/null slugs

    let finalSlugToWrite = "";
    let baseSlugForAttempts = computedSlug; // Start with the formula-generated slug

    // 1. Try computedSlug directly
    if (!existingFinalSlugs.includes(baseSlugForAttempts)) {
        finalSlugToWrite = baseSlugForAttempts;
        console.log(`Computed slug "${finalSlugToWrite}" is unique.`);
    } else {
        console.log(`Computed slug "${baseSlugForAttempts}" is a duplicate. Trying alternatives.`);

        // 2. Try with Secondary Differentiator (e.g., Year)
        if (CONFIG.secondaryDifferentiatorField && secondaryDifferentiatorValue !== null) {
            let differentiatorSlug = slugify(String(secondaryDifferentiatorValue)); // Slugify the year/differentiator
            if (differentiatorSlug) {
                let candidateWithDifferentiator = `${baseSlugForAttempts}-${differentiatorSlug}`;
                console.log(`Attempting with ${CONFIG.secondaryDifferentiatorLabel}: "${candidateWithDifferentiator}"`);
                if (!existingFinalSlugs.includes(candidateWithDifferentiator)) {
                    finalSlugToWrite = candidateWithDifferentiator;
                    console.log(`Using slug with ${CONFIG.secondaryDifferentiatorLabel}: "${finalSlugToWrite}"`);
                } else {
                    console.log(`Slug with ${CONFIG.secondaryDifferentiatorLabel} "${candidateWithDifferentiator}" is also a duplicate.`);
                    baseSlugForAttempts = candidateWithDifferentiator; // Use this as the new base for numbered suffix
                }
            }
        }

        // 3. Try with Numbered Suffix (e.g., -2, -3, ...) if still no unique slug
        if (!finalSlugToWrite) {
            console.log(`Proceeding to numbered suffix attempts. Base for numbering: "${baseSlugForAttempts}"`);
            for (let i = 2; i <= CONFIG.maxNumberedSuffix; i++) {
                let candidateWithNumber = `${baseSlugForAttempts}-${i}`;
                console.log(`Attempting with numbered suffix: "${candidateWithNumber}"`);
                if (!existingFinalSlugs.includes(candidateWithNumber)) {
                    finalSlugToWrite = candidateWithNumber;
                    console.log(`Using numbered suffix slug: "${finalSlugToWrite}"`);
                    break; // Found a unique one
                }
            }
            if (!finalSlugToWrite) {
                console.log(`Numbered suffix attempts up to -${CONFIG.maxNumberedSuffix} failed.`);
            }
        }

        // 4. Try with Record ID Suffix if still no unique slug
        if (!finalSlugToWrite) {
            console.log(`Proceeding to Record ID suffix attempts. Base for Record ID: "${baseSlugForAttempts}"`);
            let recordIdSuffix = recordId.slice(-CONFIG.recordIdSuffixLength).toLowerCase();
            let candidateWithRecordId = `${baseSlugForAttempts}-${recordIdSuffix}`;
            console.log(`Attempting with Record ID suffix: "${candidateWithRecordId}"`);

            if (!existingFinalSlugs.includes(candidateWithRecordId)) {
                finalSlugToWrite = candidateWithRecordId;
                console.log(`Using Record ID-suffixed slug: "${finalSlugToWrite}"`);
            } else {
                // Attempt with a slightly longer part of record ID or a random string as a deeper fallback
                console.log(`Record ID-suffixed slug "${candidateWithRecordId}" is also a duplicate.`);
                let alternativeSuffix = recordId.slice(-(CONFIG.recordIdSuffixLength + 2)).toLowerCase();
                if (alternativeSuffix.length < CONFIG.recordIdSuffixLength) { // Ensure it's somewhat distinct
                    alternativeSuffix = Math.random().toString(36).substring(2, 7); // Random 5 char
                }
                candidateWithRecordId = `${baseSlugForAttempts}-${alternativeSuffix}`;
                if (!existingFinalSlugs.includes(candidateWithRecordId)) {
                    finalSlugToWrite = candidateWithRecordId;
                    console.log(`Using alternative Record ID/random-suffixed slug: "${finalSlugToWrite}"`);
                } else {
                     // Last resort: timestamp to ensure uniqueness
                    finalSlugToWrite = `${baseSlugForAttempts}-${Date.now()}`;
                    console.warn(`CRITICAL FALLBACK: All attempts failed. Using timestamp: "${finalSlugToWrite}"`);
                }
            }
        }
    }

    // --- Prepare and perform updates ---
    let fieldsToUpdate = {};
    let statusMessage = "";
    let currentFinalSlugInRecord = record.getCellValue(CONFIG.finalSlugField);

    if (finalSlugToWrite) {
        if (finalSlugToWrite !== currentFinalSlugInRecord) {
            fieldsToUpdate[CONFIG.finalSlugField] = finalSlugToWrite;
        }
        output.set("finalSlugValue", finalSlugToWrite);
        if (Object.keys(fieldsToUpdate).length > 0) {
            statusMessage = "Slug to be updated.";
        } else {
            statusMessage = "Slug already correct.";
        }
    } else { // Should not happen if title/computedSlug exist due to fallbacks, but defensive
        if (currentFinalSlugInRecord) {
            fieldsToUpdate[CONFIG.finalSlugField] = ""; // Clear if it was somehow set
        }
        output.set("finalSlugValue", "");
        if (Object.keys(fieldsToUpdate).length > 0) {
            statusMessage = "Error in generation; slug to be cleared.";
        } else {
            statusMessage = "Error in generation; slug already clear.";
        }
        console.error("finalSlugToWrite was empty after all attempts. This should not happen if title exists.");
    }
    output.set("status", statusMessage);

    if (Object.keys(fieldsToUpdate).length > 0) {
        console.log(`Updating record ${recordId} with:`, fieldsToUpdate);
        await table.updateRecordAsync(recordId, fieldsToUpdate);
        console.log(`"${CONFIG.finalSlugField}" set to: "${fieldsToUpdate[CONFIG.finalSlugField]}"`);
        if (statusMessage.includes("to be updated")) {
            output.set("status", "Slug updated successfully.");
        } else if (statusMessage.includes("to be cleared")) {
            output.set("status", "Slug cleared successfully.");
        }
    } else {
        console.log("No updates needed for slug.");
    }
}

main();