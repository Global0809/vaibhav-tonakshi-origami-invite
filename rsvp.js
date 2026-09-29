/* RSVP details are sent only when the guest deliberately submits this form. */
(() => {
  'use strict';

  function initRSVP() {
    const form = document.querySelector('#rsvp-form');
    if (!form || form.dataset.rsvpReady === 'true') return;

    const button = document.querySelector('#rsvp-submit');
    const status = document.querySelector('#rsvp-status');
    const confirmation = document.querySelector('#rsvp-confirmation');
    if (!button || !status || !confirmation) return;
    form.dataset.rsvpReady = 'true';

    const attendingDetails = document.querySelector('#attending-details');
    const guestNames = document.querySelector('#additional-guest-names');
    const endpoint = 'https://formsubmit.co/ajax/vaibhavbhatiab94@gmail.com';
    const originalLabel = button.innerHTML;
    let submitting = false;

    const field = name => form.elements.namedItem(name);
    const value = name => String(field(name)?.value || '').trim();
    const isAttending = () => value('attendance') === 'Joyfully accepting';

    function setStatus(message, state = '') {
      status.textContent = message;
      status.dataset.state = state;
    }

    function enableBlock(block, enabled) {
      if (!block) return;
      block.hidden = !enabled;
      block.querySelectorAll('input, select, textarea').forEach(control => {
        control.disabled = !enabled;
      });
    }

    function updateQuestions() {
      const attending = isAttending();
      enableBlock(attendingDetails, attending);
      enableBlock(guestNames, attending && Number(value('additional_guests')) > 0);
    }

    form.addEventListener('change', updateQuestions);
    form.addEventListener('input', event => {
      if (event.target.name === 'additional_guests') updateQuestions();
      if (typeof event.target.setCustomValidity === 'function') {
        event.target.setCustomValidity('');
      }
      if (!submitting && status.dataset.state === 'error') setStatus('');
    });
    updateQuestions();

    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (submitting) return;

      const nameField = field('full_name');
      if (nameField) {
        nameField.setCustomValidity(value('full_name') ? '' : 'Please enter your name.');
      }
      if (!form.reportValidity()) return;
      const attendance = value('attendance');
      if (!['Joyfully accepting', 'Regretfully declining'].includes(attendance)) {
        setStatus('Please tell us whether you will be joining the celebrations.', 'error');
        return;
      }

      const attending = isAttending();
      const extraGuests = attending ? Number(value('additional_guests') || '0') : 0;
      if (attending && !['One day', 'Both days'].includes(value('days'))) {
        setStatus('Please choose how many days you will be joining us.', 'error');
        return;
      }
      if (!Number.isInteger(extraGuests) || extraGuests < 0 || extraGuests > 8) {
        setStatus('Please enter an additional guest count between 0 and 8.', 'error');
        return;
      }
      if (value('_honey')) {
        setStatus('We could not submit this response. Please use the email link below.', 'error');
        return;
      }

      const payload = {
        full_name: value('full_name'),
        email: value('email'),
        phone: value('phone'),
        attendance,
        days: attending ? value('days') : 'Not attending',
        additional_guests: extraGuests,
        guest_names: attending && extraGuests > 0 ? value('guest_names') : '',
        notes: attending ? value('notes') : '',
        _subject: 'Wedding RSVP — Vaibhav & Tonakshi · 25–26 November 2026',
        _template: 'table',
        _captcha: 'false',
        _honey: ''
      };

      submitting = true;
      button.disabled = true;
      button.setAttribute('aria-busy', 'true');
      button.textContent = 'Sending your RSVP…';
      setStatus('Sending your response securely…', 'pending');
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 20000);

      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(payload),
          signal: controller.signal,
          credentials: 'omit',
          referrerPolicy: 'strict-origin-when-cross-origin'
        });
        if (!response.ok) throw new Error('service-unavailable');
        const result = await response.json();
        const activationRequired = /needs? (?:to be )?activat|requires? activation|please activate|activate (?:this|your|the) form|form (?:is )?not activated/i.test(String(result.message || ''));
        if (activationRequired) throw new Error('activation-required');
        if (result.success !== true && result.success !== 'true') {
          throw new Error('not-confirmed');
        }

        let title = confirmation.querySelector('[data-rsvp-title]');
        let message = confirmation.querySelector('[data-rsvp-message]');
        let receipt = confirmation.querySelector('[data-rsvp-receipt]');
        if (!title) {
          title = document.createElement('h3');
          title.dataset.rsvpTitle = '';
          confirmation.append(title);
        }
        if (!message) {
          message = document.createElement('p');
          message.dataset.rsvpMessage = '';
          confirmation.append(message);
        }
        if (!receipt) {
          receipt = document.createElement('p');
          receipt.dataset.rsvpReceipt = '';
          confirmation.append(receipt);
        }
        title.textContent = attending ? 'We can’t wait to celebrate with you.' : 'Thank you for letting us know.';
        message.textContent = attending
          ? 'Thank you for your RSVP! We are so excited to celebrate with you and look forward to creating beautiful memories together.'
          : 'You will be missed at the celebrations. Thank you for being part of our story — we send you our love.';
        receipt.textContent = 'Your response has been accepted by our RSVP service.';
        setStatus('Response accepted by the RSVP service.', 'success');
        form.hidden = true;
        confirmation.hidden = false;
        confirmation.setAttribute('tabindex', '-1');
        confirmation.focus({ preventScroll: true });
        confirmation.scrollIntoView({ behavior: 'auto', block: 'nearest' });
      } catch (error) {
        if (error.name === 'AbortError') {
          setStatus('The connection took too long, so we couldn’t confirm your RSVP. Your details are still here. Please retry or use the email link below.', 'error');
        } else if (error.message === 'activation-required') {
          setStatus('Online RSVP is still being activated. Please use the email link below to send your attendance details to us.', 'error');
        } else {
          setStatus('We couldn’t confirm your RSVP. Your details are still here — please try again or use the email link below.', 'error');
        }
      } finally {
        window.clearTimeout(timeout);
        submitting = false;
        button.disabled = false;
        button.removeAttribute('aria-busy');
        button.innerHTML = originalLabel;
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initRSVP, { once: true });
  } else {
    initRSVP();
  }
})();
