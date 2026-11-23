import { useState, useEffect, useRef } from 'react'

export default function SearchSelect({
  doctors,
  value,
  onChange,
  onAddNew,
  placeholder = 'Search doctor by name or specialty',
}) {
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const wrapRef = useRef(null)
  const activeOptionRef = useRef(null)
  const inputRef = useRef(null)

  const selectedDoctor = doctors.find(d => d.id === value)
  const query = search.trim().toLowerCase()
  const filtered = query
    ? doctors.filter(d =>
        d.name?.toLowerCase().includes(query) ||
        d.specialty?.toLowerCase().includes(query))
    : doctors
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

  const choose = (doc) => {
    onChange(doc.id)
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
      className="doctor-search-wrap"
      ref={wrapRef}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) {
          setOpen(false)
          setSearch('')
        }
      }}
    >
      <div className="doctor-search-input">
        <input
          type="text"
          ref={inputRef}
          placeholder={selectedDoctor ? `${selectedDoctor.name} - ${selectedDoctor.specialty}` : placeholder}
          value={search}
          onFocus={() => setOpen(true)}
          onChange={(e) => { setSearch(e.target.value); setOpen(true) }}
          onKeyDown={handleKeyDown}
          autoComplete="off"
        />
        {onAddNew && (
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            title="Add New Doctor"
            onClick={onAddNew}
          >+</button>
        )}
      </div>
      {open && (
        <div className="doctor-dropdown">
          {filtered.length > 0 ? filtered.map((d, i) => (
            <div
              key={d.id}
              ref={i === effectiveIndex ? activeOptionRef : null}
              className={`doctor-option${d.id === value ? ' selected' : ''}${i === effectiveIndex ? ' highlighted' : ''}`}
              onMouseEnter={() => setActiveIndex(i)}
              onMouseDown={(e) => { e.preventDefault(); choose(d) }}
            >
              <span className="doc-name">{d.name}</span>
              <span className="doc-spec">{d.specialty}</span>
            </div>
          )) : (
            <div className="doctor-option-empty">No doctors match</div>
          )}
        </div>
      )}
    </div>
  )
}