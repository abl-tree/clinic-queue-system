import { useState, useEffect, useRef } from 'react'

export default function SearchSelect({
  options = [],
  value,
  onChange,
  onAddNew,
  placeholder = 'Search',
  labelKey = 'name',
  searchKeys,
  valueKey = 'id',
  optionTitle,
  noResultsText = 'No matches',
}) {
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const wrapRef = useRef(null)
  const activeOptionRef = useRef(null)
  const inputRef = useRef(null)

  const keys = searchKeys || [labelKey]

  const getLabel = (opt) => {
    if (optionTitle) return optionTitle(opt)
    return opt[labelKey] ?? ''
  }

  const selected = options.find(o => o[valueKey] === value)
  const selectedLabel = selected ? getLabel(selected) : ''
  const displayValue = open ? search : selectedLabel
  const query = search.trim().toLowerCase()

  const filtered = query
    ? options.filter(o =>
        keys.some(k => String(o[k] ?? '').toLowerCase().includes(query)))
    : options
  const effectiveIndex = activeIndex === -1 ? 0 : activeIndex

  useEffect(() => {
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false)
        setSearch('')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => { setActiveIndex(-1) }, [search])

  useEffect(() => {
    if (activeOptionRef.current) activeOptionRef.current.scrollIntoView({ block: 'nearest' })
  }, [effectiveIndex])

  const choose = (opt) => {
    onChange(opt[valueKey])
    setSearch('')
    setOpen(false)
    if (inputRef.current) inputRef.current.blur()
  }

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setOpen(true)
      setActiveIndex(Math.min(effectiveIndex + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex(Math.max(effectiveIndex - 1, 0))
    } else if (e.key === 'Enter') {
      if (filtered.length > 0) {
        e.preventDefault()
        choose(filtered[effectiveIndex])
      }
    } else if (e.key === 'Escape') {
      setOpen(false)
    } else if (e.key === 'Tab') {
      setOpen(false)
      setSearch('')
    }
  }

  return (
    <div
      className="search-select-wrap"
      ref={wrapRef}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) {
          setOpen(false)
          setSearch('')
        }
      }}
    >
      <div className="search-select-input">
        <input
          type="text"
          ref={inputRef}
          placeholder={placeholder}
          value={displayValue}
          onFocus={() => setOpen(true)}
          onChange={(e) => { setSearch(e.target.value); setOpen(true) }}
          onKeyDown={handleKeyDown}
          autoComplete="off"
        />
        {onAddNew && (
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            title="Add New"
            onClick={onAddNew}
          >+</button>
        )}
      </div>
      {open && (
        <div className="search-select-dropdown">
          {filtered.length > 0 ? filtered.map((opt, i) => {
            const label = optionTitle ? optionTitle(opt) : opt[labelKey]
            return (
              <div
                key={opt[valueKey]}
                ref={i === effectiveIndex ? activeOptionRef : null}
                className={`search-select-option${opt[valueKey] === value ? ' selected' : ''}${i === effectiveIndex ? ' highlighted' : ''}`}
                onMouseEnter={() => setActiveIndex(i)}
                onMouseDown={(e) => { e.preventDefault(); choose(opt) }}
              >
                <span className="opt-label">{label}</span>
              </div>
            )
          }) : (
            <div className="search-select-empty">{noResultsText}</div>
          )}
        </div>
      )}
    </div>
  )
}