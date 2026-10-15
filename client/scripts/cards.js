function renderInvoice(order) {
    if (printRenderTablesOnly) {
        return renderInvoicePrintTablesOnly(order);
    }

    const card = createEl("section", "invoice");
    const orderNumber = getOrderNumber(order);
    if (orderNumber) card.dataset.orderNumber = orderNumber;

    const head = createEl("div", "invoice-head");
    const headLeft = createEl("div", "invoice-head-left");
    const titleRow = createEl("div", "invoice-title-row");
    titleRow.appendChild(createEl("h2", "invoice-title", "ORDER " + (order.orderNumber || "(missing #)")));

    const tagWrap = createEl("div", "invoice-tag-wrap");
    const tags = Array.from(getOrderTags(orderNumber)).sort(function(a, b) {
        return a.localeCompare(b, undefined, { sensitivity: "base" });
    });
    for (let i = 0; i < tags.length; i += 1) {
        const tagBtn = createEl("button", "invoice-tag", tags[i] + " ×");
        tagBtn.type = "button";
        tagBtn.title = "Remove tag";
        tagBtn.addEventListener("click", function() {
            if (!removeOrderTag(orderNumber, tags[i])) return;
            saveOrderTags();
            renderCustomTagFilters();
            if (selectedCustomTags.size) applyFilter(true);
            else renderPage(true);
        });
        tagWrap.appendChild(tagBtn);
    }

    const addTagBtn = createEl("button", "add-tag-btn", "Add a tag");
    addTagBtn.type = "button";
    if (tags.length >= MAX_TAGS_PER_ORDER) {
        addTagBtn.disabled = true;
        addTagBtn.title = "Maximum 4 tags per order";
    }
    addTagBtn.addEventListener("click", function() {
        if (typeof closeActiveTagEditor === "function") {
            closeActiveTagEditor();
        }

        const existingEditor = titleRow.querySelector(".inline-tag-editor");
        if (existingEditor) {
            const currentInput = existingEditor.querySelector(".inline-tag-input");
            if (currentInput) currentInput.focus();
            return;
        }

        const closeEditor = function() {
            const editor = titleRow.querySelector(".inline-tag-editor");
            if (editor) editor.remove();
            addTagBtn.hidden = false;
            if (closeActiveTagEditor === closeEditor) {
                closeActiveTagEditor = null;
            }
        };

        addTagBtn.hidden = true;
        const editor = createEl("div", "inline-tag-editor");
        const input = document.createElement("input");
        input.type = "text";
        input.className = "inline-tag-input";
        input.placeholder = "New tag";

        const commitTag = function(value) {
            const nextTag = normalizeTag(value);
            if (!nextTag) return false;
            if (!addOrderTag(orderNumber, nextTag)) return false;
            saveOrderTags();
            renderCustomTagFilters();
            if (selectedCustomTags.size) applyFilter(true);
            else renderPage(true);
            return true;
        };

        input.addEventListener("keydown", function(event) {
            if (event.key === "Enter") {
                event.preventDefault();
                if (!commitTag(input.value)) {
                    closeEditor();
                }
            }
            if (event.key === "Escape") {
                event.preventDefault();
                closeEditor();
            }
        });
        input.addEventListener("blur", function() {
            setTimeout(function() {
                const active = document.activeElement;
                if (active && editor.contains(active)) return;
                if (normalizeTag(input.value)) return;
                closeEditor();
            }, 0);
        });

        editor.appendChild(input);

        const options = createEl("div", "inline-tag-options");
        const knownTags = getAllKnownTags();
        const applied = getOrderTags(orderNumber);
        for (let i = 0; i < knownTags.length; i += 1) {
            const candidate = knownTags[i];
            let alreadyApplied = false;
            for (const entry of applied) {
                if (normalizeTagKey(entry) === normalizeTagKey(candidate)) {
                    alreadyApplied = true;
                    break;
                }
            }
            if (alreadyApplied) continue;
            const optionBtn = createEl("button", "inline-tag-option", "+ " + knownTags[i]);
            optionBtn.type = "button";
            optionBtn.addEventListener("click", function() {
                if (!commitTag(knownTags[i])) {
                    closeEditor();
                }
            });
            options.appendChild(optionBtn);
        }
        editor.appendChild(options);

        titleRow.appendChild(editor);
        closeActiveTagEditor = closeEditor;
        input.focus();
    });
    tagWrap.appendChild(addTagBtn);
    titleRow.appendChild(tagWrap);
    headLeft.appendChild(titleRow);
    head.appendChild(headLeft);

    const headRight = createEl("div", "invoice-head-right");
    headRight.appendChild(createEl("div", "invoice-sub", getLastModifiedHeading(order)));

    headRight.appendChild(createEl("span", "invoice-head-divider"));
    const markLabel = createEl("label", "status-check invoice-mark-check");
    const markInput = document.createElement("input");
    markInput.type = "checkbox";
    markInput.checked = markedInvoiceNumbers.has(orderNumber);
    markInput.setAttribute("aria-label", "Mark order for review");
    markLabel.appendChild(markInput);
    markLabel.appendChild(document.createTextNode("Mark for Review"));

    markInput.addEventListener("change", function() {
        const shouldMark = !!markInput.checked;
        setInvoiceMarked(orderNumber, shouldMark);
        if (requireMarked) {
            applyFilter();
        }
    });
    headRight.appendChild(markLabel);
    head.appendChild(headRight);
    card.appendChild(head);

    const summary = createEl("div", "summary");
    const bill = createEl("div", "block");
    bill.appendChild(createEl("h3", "", "Bill To"));
    bill.appendChild(createEl("div", "billto", (order.customerAddress || []).join("\n") || "(no customer address data)"));
    summary.appendChild(bill);

    const vehicle = createEl("div", "block");
    vehicle.appendChild(createEl("h3", "", "Vehicle"));
    vehicle.appendChild(renderPairsTable(order.vehicleDetail || []));
    summary.appendChild(vehicle);
    card.appendChild(summary);

    const sectionGrid = createEl("div", "section-grid");
    const detail = createEl("div", "block");
    detail.appendChild(createEl("h3", "", "Order Details"));
    detail.appendChild(renderInvoiceDetailsTable(order));
    sectionGrid.appendChild(detail);

    const totals = createEl("div", "block");
    totals.appendChild(createEl("h3", "", "Financials"));
    const totalsPairs = buildFinancialPairs(order);
    totals.appendChild(renderPairsTable(totalsPairs));
    sectionGrid.appendChild(totals);
    card.appendChild(sectionGrid);

    const paymentsBlock = createEl("div", "block block-spaced");
    paymentsBlock.appendChild(createEl("h3", "", "Transactions"));
    paymentsBlock.appendChild(renderPaymentTransactionsTable(order.paymentTransactions || []));
    card.appendChild(paymentsBlock);

    const notesBlock = createEl("div", "block block-spaced");
    const serviceNotesText = (order.serviceNotes || []).join("\n").trim();
    notesBlock.appendChild(createEl("h3", "", "Service Notes"));
    notesBlock.appendChild(createEl("div", serviceNotesText ? "notes" : "muted", serviceNotesText || "No service notes"));
    card.appendChild(notesBlock);

    const itemsBlock = createEl("div", "block");
    itemsBlock.appendChild(createEl("h3", "", "Line Items"));
    itemsBlock.appendChild(renderLineItemsTable(order.lineItems || []));
    card.appendChild(itemsBlock);

    return card;
}

