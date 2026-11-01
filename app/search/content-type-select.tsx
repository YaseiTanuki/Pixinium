'use client'

import { Select } from '@base-ui/react/select'
import { Check, ChevronDown } from 'lucide-react'
import { searchCategories } from '@/lib/search-filters'

export function ContentTypeSelect({ value, options, onChange, disabled }: {
  value: string; options: { value: string; label: string }[]
  onChange: (value: string) => void; disabled: boolean
}) {
  const selected = searchCategories(value)
  const summary = selected.length ? selected.map(value => options.find(option => option.value === value)?.label ?? value).join(', ') : 'All content types'
  return <div className="search-filter-field">
    <span id="search-category-label" className="search-filter-label">Content types</span>
    <Select.Root multiple items={options} value={selected} onValueChange={values => onChange(values.join(','))} disabled={disabled} modal={false}>
      <Select.Trigger id="search-category" className="search-select-trigger" aria-labelledby="search-category-label search-category-value">
        <Select.Value id="search-category-value">{summary}</Select.Value>
        <Select.Icon><ChevronDown size={15} aria-hidden="true" /></Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Positioner sideOffset={6} alignItemWithTrigger={false} className="search-select-positioner">
          <Select.Popup className="search-select-popup">
            <button type="button" className="search-content-types-clear" onClick={() => onChange('')}>All content types</button>
            <Select.List className="search-select-list">
              {options.map(option => <Select.Item key={option.value} value={option.value} className="search-select-option search-content-type-option">
                <span className="search-content-type-check"><Select.ItemIndicator><Check size={13} aria-hidden="true" /></Select.ItemIndicator></span>
                <Select.ItemText>{option.label}</Select.ItemText>
              </Select.Item>)}
            </Select.List>
          </Select.Popup>
        </Select.Positioner>
      </Select.Portal>
    </Select.Root>
  </div>
}
