'use client'

import { Select } from '@base-ui/react/select'
import { Check, ChevronDown } from 'lucide-react'

type Option = { value: string; label: string }

export function FilterSelect({ id, label, value, options, onChange, disabled }: {
  id: string; label: string; value: string; options: readonly Option[]
  onChange: (value: string) => void; disabled?: boolean
}) {
  return <div className="search-filter-field">
    <span id={`${id}-label`} className="search-filter-label">{label}</span>
    <Select.Root items={options} value={value} onValueChange={value => onChange(value ?? '')} disabled={disabled} modal={false}>
      <Select.Trigger id={id} className="search-select-trigger" aria-labelledby={`${id}-label ${id}-value`}>
        <Select.Value id={`${id}-value`} />
        <Select.Icon><ChevronDown size={15} aria-hidden="true" /></Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Positioner sideOffset={6} alignItemWithTrigger={false} className="search-select-positioner">
          <Select.Popup className="search-select-popup">
            <Select.List className="search-select-list">
              {options.map(option => <Select.Item key={option.value} value={option.value} className="search-select-option">
                <Select.ItemText>{option.label}</Select.ItemText>
                <Select.ItemIndicator><Check size={15} aria-hidden="true" /></Select.ItemIndicator>
              </Select.Item>)}
            </Select.List>
          </Select.Popup>
        </Select.Positioner>
      </Select.Portal>
    </Select.Root>
  </div>
}
