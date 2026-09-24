// Universal AACR2 Validation and Patch Script
module.exports = function applyUniversalPatch(entry) {
    if (entry && entry.title) {
        entry.title = entry.title.replace(/^(the serial publication|publication|book)\s+/i, '').trim();
    }
    return entry;
};
