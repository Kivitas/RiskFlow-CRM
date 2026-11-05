import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import Pagination, { PAGE_SIZE, paginate } from './Pagination';

beforeAll(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
});

describe('PAGE_SIZE', () => {
  it('is 25 rows per page', () => {
    expect(PAGE_SIZE).toBe(25);
  });
});

describe('paginate', () => {
  const items = Array.from({ length: 60 }, (_, i) => i + 1);

  it('returns the first page slice by default', () => {
    const page = paginate(items, 1);
    expect(page).toHaveLength(25);
    expect(page[0]).toBe(1);
    expect(page.at(-1)).toBe(25);
  });

  it('returns the requested middle page', () => {
    expect(paginate(items, 2)[0]).toBe(26);
  });

  it('returns the partial last page', () => {
    const last = paginate(items, 3);
    expect(last).toEqual(items.slice(50, 60));
    expect(last).toHaveLength(10);
  });

  it('clamps a page past the end to the last page', () => {
    expect(paginate(items, 99)).toEqual(items.slice(50, 60));
  });

  it('clamps a page below 1 (including 0 and negatives) to the first page', () => {
    expect(paginate(items, 0)).toEqual(items.slice(0, 25));
    expect(paginate(items, -4)).toEqual(items.slice(0, 25));
  });

  it('returns an empty array for no items, on any page', () => {
    expect(paginate([], 1)).toEqual([]);
    expect(paginate([], 5)).toEqual([]);
  });

  it('accepts a custom page size', () => {
    expect(paginate(items, 2, 10)).toEqual(items.slice(10, 20));
    expect(paginate(items, 6, 10)).toEqual(items.slice(50, 60));
  });

  it('does not mutate the input array', () => {
    const copy = [...items];
    paginate(items, 2);
    expect(items).toEqual(copy);
  });
});

describe('Pagination component', () => {
  let container;
  let root;

  const render = (props) => {
    act(() => {
      root.render(<Pagination {...props} />);
    });
  };

  const text = () => container.textContent;
  const button = (name) => [...container.querySelectorAll('button')].find((b) => b.textContent.trim() === name);

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('shows the range and page summary for the first page', () => {
    render({ page: 1, total: 60, onPageChange: () => {} });
    expect(text()).toContain('Showing 1–25 of 60 items');
    expect(text()).toContain('Page 1 of 3');
  });

  it('uses the provided label', () => {
    render({ page: 1, total: 60, label: 'contacts', onPageChange: () => {} });
    expect(text()).toContain('Showing 1–25 of 60 contacts');
  });

  it('disables Previous and enables Next on the first page', () => {
    render({ page: 1, total: 60, onPageChange: () => {} });
    expect(button('Previous').disabled).toBe(true);
    expect(button('Next').disabled).toBe(false);
  });

  it('disables Next and enables Previous on the last page', () => {
    render({ page: 3, total: 60, onPageChange: () => {} });
    expect(text()).toContain('Showing 51–60 of 60 items');
    expect(text()).toContain('Page 3 of 3');
    expect(button('Previous').disabled).toBe(false);
    expect(button('Next').disabled).toBe(true);
  });

  it('enables both buttons on a middle page', () => {
    render({ page: 2, total: 60, onPageChange: () => {} });
    expect(text()).toContain('Showing 26–50 of 60 items');
    expect(button('Previous').disabled).toBe(false);
    expect(button('Next').disabled).toBe(false);
  });

  it('shows an empty state range when there are no items', () => {
    render({ page: 1, total: 0, onPageChange: () => {} });
    expect(text()).toContain('Showing 0–0 of 0 items');
    expect(text()).toContain('Page 1 of 1');
    expect(button('Previous').disabled).toBe(true);
    expect(button('Next').disabled).toBe(true);
  });

  it('calls onPageChange with the next and previous page numbers', () => {
    const onPageChange = vi.fn();
    render({ page: 2, total: 60, onPageChange });

    act(() => button('Next').click());
    expect(onPageChange).toHaveBeenLastCalledWith(3);

    act(() => button('Previous').click());
    expect(onPageChange).toHaveBeenLastCalledWith(1);
  });

  it('clamps an out-of-range page prop when rendering the summary', () => {
    render({ page: 99, total: 60, onPageChange: () => {} });
    expect(text()).toContain('Showing 51–60 of 60 items');
    expect(text()).toContain('Page 3 of 3');
  });

  it('honours a custom pageSize', () => {
    render({ page: 1, total: 60, pageSize: 10, onPageChange: () => {} });
    expect(text()).toContain('Showing 1–10 of 60 items');
    expect(text()).toContain('Page 1 of 6');
  });

  it('exposes a labelled navigation landmark', () => {
    render({ page: 1, total: 60, onPageChange: () => {} });
    const nav = container.querySelector('nav');
    expect(nav.getAttribute('aria-label')).toBe('Pagination');
  });
});
