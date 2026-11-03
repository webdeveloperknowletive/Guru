path = 'astroveda/components/RudrakshaSection.js'
with open(path, 'r', encoding='utf-8') as f:
    text = f.read()

target1 = """  const [isAtStart, setIsAtStart] = useState(true);
  const [isAtEnd, setIsAtEnd] = useState(false);"""

repl1 = """  const [canScroll, setCanScroll] = useState(false);
  const [isAtStart, setIsAtStart] = useState(true);
  const [isAtEnd, setIsAtEnd] = useState(false);"""

target2 = """  const updateArrowStates = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    const maxScroll = Math.max(0, track.scrollWidth - track.clientWidth);
    const currentScroll = track.scrollLeft;
    setIsAtStart(currentScroll <= 5);
    setIsAtEnd(currentScroll >= maxScroll - 5 || maxScroll <= 0);
  }, []);"""

repl2 = """  const updateArrowStates = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    const overflow = track.scrollWidth > track.clientWidth + 2;
    setCanScroll(overflow);

    if (overflow) {
      const maxScroll = Math.max(0, track.scrollWidth - track.clientWidth);
      const currentScroll = track.scrollLeft;
      setIsAtStart(currentScroll <= 5);
      setIsAtEnd(currentScroll >= maxScroll - 5 || maxScroll <= 0);
    } else {
      setIsAtStart(true);
      setIsAtEnd(true);
    }
  }, []);"""

target3 = """          <div
            ref={trackRef}
            className="rudraksha-carousel-track"
            tabIndex={0}
            role="region"
            aria-label="Rudraksha products carousel"
          >"""

repl3 = """          <div
            ref={trackRef}
            className={`rudraksha-carousel-track${!canScroll ? ' no-scroll' : ''}`}
            tabIndex={canScroll ? 0 : -1}
            role="region"
            aria-label="Rudraksha products carousel"
          >"""

target4 = """          {sortedList.length > 0 && (
            <div className="rudraksha-nav-controls">"""

repl4 = """          {canScroll && sortedList.length > 0 && (
            <div className="rudraksha-nav-controls">"""

norm_text = text.replace('\r\n', '\n')
assert target1 in norm_text, 'target1 not found'
assert target2 in norm_text, 'target2 not found'
assert target3 in norm_text, 'target3 not found'
assert target4 in norm_text, 'target4 not found'

norm_text = norm_text.replace(target1, repl1, 1)
norm_text = norm_text.replace(target2, repl2, 1)
norm_text = norm_text.replace(target3, repl3, 1)
norm_text = norm_text.replace(target4, repl4, 1)

with open(path, 'w', encoding='utf-8', newline='\r\n') as f:
    f.write(norm_text)

print('Updated RudrakshaSection.js successfully!')

