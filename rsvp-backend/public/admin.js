(() => {
  "use strict";
  const $ = (selector) => document.querySelector(selector);
  const login = $("#login-panel"),
    dashboard = $("#dashboard");
  let responses = [],
    loading = false;
  const dateLabel = (date) =>
    new Intl.DateTimeFormat("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Asia/Kolkata",
    }).format(new Date(date));
  function showLogin(message = "") {
    responses = [];
    $("#response-list").replaceChildren();
    $("#export").disabled = true;
    dashboard.hidden = true;
    login.hidden = false;
    $("#login-status").textContent = message;
  }
  async function api(path, options = {}) {
    const res = await fetch(path, {
      credentials: "same-origin",
      cache: "no-store",
      ...options,
      headers: { "Content-Type": "application/json", ...options.headers },
    });
    const data = await res.json();
    if (!res.ok) {
      const error = new Error(data.error || "Could not complete this request.");
      error.status = res.status;
      throw error;
    }
    return data;
  }
  function element(tag, text, className = "") {
    const node = document.createElement(tag);
    node.textContent = text;
    if (className) node.className = className;
    return node;
  }
  function detail(label, value) {
    const row = element("div", "");
    row.append(element("dt", label), element("dd", value));
    return row;
  }
  function card(row) {
    const article = element("article", "", "response-card");
    const primary = element("div", "", "guest-primary");
    const heading = element("div", "", "guest-heading");
    const attending = row.attendance === "Joyfully accepting";
    heading.append(
      element("h2", row.full_name),
      element(
        "span",
        attending ? "Attending" : "Declined",
        attending ? "badge" : "badge declined",
      ),
    );
    const phone = element("a", row.phone);
    phone.href = "tel:" + row.phone.replace(/[^+\d]/g, "");
    primary.append(
      heading,
      phone,
      element(
        "time",
        "Received " + dateLabel(row.created_at) + " IST",
        "received",
      ),
    );
    const details = element("dl", "", "guest-details");
    details.append(
      detail("Days attending", row.days),
      detail(
        "Party size",
        attending
          ? String(1 + row.additional_guests) +
              (row.additional_guests
                ? " · includes " + row.additional_guests + " additional"
                : " · just them")
          : "Not attending",
      ),
    );
    if (row.guest_names)
      details.append(detail("Additional guests", row.guest_names));
    const note = element("div", "", "guest-note");
    note.append(
      element("strong", "Note for the hosts"),
      element("p", row.notes || "No note added."),
    );
    article.append(primary, details, note);
    return article;
  }
  function render() {
    const attending = responses.filter(
      (row) => row.attendance === "Joyfully accepting",
    );
    $("#total-responses").textContent = responses.length;
    $("#total-guests").textContent = attending.reduce(
      (total, row) => total + 1 + row.additional_guests,
      0,
    );
    $("#total-both").textContent = attending
      .filter((row) => row.days === "Both days")
      .reduce((total, row) => total + 1 + row.additional_guests, 0);
    $("#total-declined").textContent = responses.length - attending.length;
    const search = $("#search").value.trim().toLocaleLowerCase();
    const filter = $("#filter").value;
    const filtered = responses.filter(
      (row) =>
        (filter === "all" ||
          (row.attendance === "Joyfully accepting") ===
            (filter === "accept")) &&
        [row.full_name, row.phone, row.guest_names, row.notes].some((value) =>
          value.toLocaleLowerCase().includes(search),
        ),
    );
    $("#response-list").replaceChildren(...filtered.map(card));
    $("#empty").hidden = responses.length !== 0;
    $("#no-results").hidden = responses.length === 0 || filtered.length > 0;
    $("#shown-count").textContent =
      `${filtered.length} of ${responses.length} shown`;
    $("#export").disabled = responses.length === 0;
  }
  async function load(initial = false) {
    if (loading) return;
    loading = true;
    $("#refresh").disabled = true;
    $("#refresh").textContent = "Refreshing…";
    $("#dashboard-status").textContent = "";
    try {
      const data = await api("/api/admin/rsvps");
      responses = data.responses;
      login.hidden = true;
      dashboard.hidden = false;
      render();
      $("#updated").textContent =
        "Last refreshed " + dateLabel(data.fetched_at) + " IST";
      if (initial) $("#dashboard-title").focus();
    } catch (error) {
      if (error.status === 401) showLogin(initial ? "" : error.message);
      else if (!dashboard.hidden)
        $("#dashboard-status").textContent =
          "Could not refresh. Any responses shown are from the last successful refresh. Please try again.";
      else
        $("#login-status").textContent =
          "Could not connect. Please check your connection and try signing in.";
    } finally {
      loading = false;
      $("#refresh").disabled = false;
      $("#refresh").textContent = "Refresh";
    }
  }
  $("#login-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    $("#login-button").disabled = true;
    $("#login-status").textContent = "Signing in…";
    try {
      await api("/api/login", {
        method: "POST",
        body: JSON.stringify({ password: $("#password").value }),
      });
      $("#password").value = "";
      $("#show-password").checked = false;
      $("#password").type = "password";
      await load(true);
    } catch (error) {
      $("#login-status").textContent = error.status
        ? error.message
        : "Could not connect. Please try again.";
    } finally {
      $("#login-button").disabled = false;
    }
  });
  $("#show-password").addEventListener("change", (event) => {
    $("#password").type = event.target.checked ? "text" : "password";
  });
  $("#refresh").addEventListener("click", () => load());
  $("#search").addEventListener("input", render);
  $("#filter").addEventListener("change", render);
  $("#logout").addEventListener("click", async () => {
    $("#logout").disabled = true;
    try {
      await api("/api/logout", { method: "POST", body: "{}" });
      showLogin("You have signed out.");
      $("#password").focus();
    } catch {
      $("#dashboard-status").textContent =
        "Sign-out could not be confirmed. Please reconnect and try again.";
    } finally {
      $("#logout").disabled = false;
    }
  });
  $("#export").addEventListener("click", () => {
    const escape = (value) => {
      const text = String(value ?? "");
      return (
        '"' +
        (/^[\s]*[=+@-]|^[\t\r\n]/.test(text) ? "'" : "") +
        text.replace(/"/g, '""') +
        '"'
      );
    };
    const columns = [
      "Received (UTC)",
      "Name",
      "Phone",
      "Attendance",
      "Days",
      "Additional guests",
      "Additional guest names",
      "Notes",
      "Receipt",
    ];
    const rows = responses.map((row) => [
      row.created_at,
      row.full_name,
      row.phone,
      row.attendance,
      row.days,
      row.additional_guests,
      row.guest_names,
      row.notes,
      row.id,
    ]);
    const blob = new Blob(
      [
        "\uFEFF" +
          [columns, ...rows]
            .map((row) => row.map(escape).join(","))
            .join("\r\n"),
      ],
      { type: "text/csv;charset=utf-8" },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download =
      "vaibhav-tonakshi-rsvps-" +
      new Date().toISOString().slice(0, 10) +
      ".csv";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  load();
})();
