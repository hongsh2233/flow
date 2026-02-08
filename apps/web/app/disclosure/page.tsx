'use client'

import React, { Suspense } from 'react'
import PageTitle from '../components/element/PageTitle'
import Tabs from '../components/element/tabsUi/Tabs'
import TabList from '../components/element/tabsUi/TabList'
import TabPanel from '../components/element/tabsUi/TabPanel'
import TabCont from '../components/element/tabsUi/TabCont'
import NaverNews from '../components/module/NaverNews'
import { useNavTabs } from '../hooks/useNavTabs'

function TabListWrapper({ 
  items, 
  activeValue, 
  setActiveValue 
}: { 
  items: Array<{ label: string; href?: string; value?: string }>
  activeValue?: string
  setActiveValue?: (val: string) => void
}) {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <TabList 
        items={items} 
        variant="tab" 
        activeValue={activeValue}
        setActiveValue={setActiveValue}
      />
    </Suspense>
  )
}

function DisclosureContent() {
  const { tabs } = useNavTabs()
  const menuData = tabs.length > 0 
    ? tabs.map((t, index) => ({ label: t.label, href: t.href, value: index.toString() })) 
    : []

  return (
    <div className="content__wrap">
      <PageTitle label="금융/주식 뉴스" />
      <Tabs>
        <TabListWrapper items={menuData} />
        <TabPanel>
          {menuData.length > 0 ? (
            menuData.map((tab, index) => (
              <TabCont key={index}>
                <NaverNews />
              </TabCont>
            ))
          ) : (
            <TabCont>
              <NaverNews />
            </TabCont>
          )}
        </TabPanel>
      </Tabs>
    </div>
  )
}

export default function DisclosurePage() {
  return (
    <Suspense fallback={<div className="content__wrap"><PageTitle label="금융/주식 뉴스" /></div>}>
      <DisclosureContent />
    </Suspense>
  )
}
