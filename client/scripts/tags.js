function renderCustomTagFilters() {
    const knownTags = getAllKnownTags();
    customTagFilters.replaceChildren();

    if (!knownTags.length) {
        customTagEmpty.style.display = "block";
        selectedCustomTags.clear();
        return;
    }
    customTagEmpty.style.display = "none";

    const fragment = document.createDocumentFragment();
    for (let i = 0; i < knownTags.length; i += 1) {
        const tag = knownTags[i];
        const key = normalizeTagKey(tag);
        const btn = createEl("button", "tag-btn button is-small", tag);
        btn.type = "button";
        applyTagVisual(btn, selectedCustomTags.has(key));
        btn.addEventListener("click", function() {
            if (selectedCustomTags.has(key)) selectedCustomTags.delete(key);
            else selectedCustomTags.add(key);
            applyTagVisual(btn, selectedCustomTags.has(key));
            applyFilter();
        });
        fragment.appendChild(btn);
    }
    customTagFilters.appendChild(fragment);
}

function renderSalespersonFilters() {
    const names = getAllKnownSalespeople();
    salespersonFilters.replaceChildren();

    if (!names.length) {
        salespersonEmpty.style.display = "block";
        selectedSalespeople.clear();
        return;
    }
    salespersonEmpty.style.display = "none";

    const fragment = document.createDocumentFragment();
    for (let i = 0; i < names.length; i += 1) {
        const name = names[i];
        const key = normalizeSalespersonKey(name);
        const btn = createEl("button", "tag-btn button is-small", name);
        btn.type = "button";
        applyTagVisual(btn, selectedSalespeople.has(key));
        btn.addEventListener("click", function() {
            if (selectedSalespeople.has(key)) selectedSalespeople.delete(key);
            else selectedSalespeople.add(key);
            applyTagVisual(btn, selectedSalespeople.has(key));
            applyFilter();
        });
        fragment.appendChild(btn);
    }
    salespersonFilters.appendChild(fragment);
}

function createEl(tag, className, text) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text != null) el.textContent = String(text);
    return el;
}

function renderEmptyState() {
    destroyInvoiceCharts();
    const box = createEl("section", "empty-state");
    box.appendChild(createEl("h3", "", "No matching orders"));
    box.appendChild(createEl("p", "", "Try broadening your search, adjusting tags, or clearing one or more filters."));
    container.replaceChildren(box);
}

