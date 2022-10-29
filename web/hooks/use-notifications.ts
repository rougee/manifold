import { useMemo } from 'react'
import { PrivateUser } from 'common/user'
import { Notification } from 'common/notification'
import { listenForNotifications } from 'web/lib/firebase/notifications'
import { groupBy, map, partition } from 'lodash'
import { useStore } from './use-store'

export type NotificationGroup = {
  notifications: Notification[]
  groupedById: string
  isSeen: boolean
  timePeriod: string
  type: 'income' | 'normal'
}

function useNotifications(privateUser: PrivateUser) {
  return useStore(privateUser.id, listenForNotifications, {
    prefix: 'notifications',
  })
}

export function useUnseenNotifications(privateUser: PrivateUser) {
  const notifications = useNotifications(privateUser)
  return useMemo(
    () => notifications && notifications.filter((n) => !n.isSeen),
    [notifications]
  )
}

export function useGroupedNotifications(privateUser: PrivateUser) {
  const notifications = useNotifications(privateUser)
  return useMemo(() => {
    return notifications ? groupNotifications(notifications) : undefined
  }, [notifications])
}

export function useUnseenGroupedNotification(privateUser: PrivateUser) {
  const notifications = useUnseenNotifications(privateUser)
  return useMemo(() => {
    return notifications ? groupNotifications(notifications) : undefined
  }, [notifications])
}

export function groupNotifications(notifications: Notification[]) {
  let notificationGroups: NotificationGroup[] = []
  const notificationGroupsByDay = groupBy(notifications, (notification) =>
    new Date(notification.createdTime).toDateString()
  )
  const incomeSourceTypes = [
    'bonus',
    'tip',
    'loan',
    'betting_streak_bonus',
    'tip_and_like',
  ]

  Object.keys(notificationGroupsByDay).forEach((day) => {
    const notificationsGroupedByDay = notificationGroupsByDay[day]
    const [incomeNotifications, normalNotificationsGroupedByDay] = partition(
      notificationsGroupedByDay,
      (notification) =>
        incomeSourceTypes.includes(notification.sourceType ?? '')
    )
    if (incomeNotifications.length > 0) {
      notificationGroups = notificationGroups.concat({
        notifications: incomeNotifications,
        groupedById: 'income' + day,
        isSeen: incomeNotifications[0].isSeen,
        timePeriod: day,
        type: 'income',
      })
    }
    // Group notifications by contract, filtering out bonuses:
    const groupedNotificationsByContractId = groupBy(
      normalNotificationsGroupedByDay,
      (notification) => {
        return notification.sourceContractId
      }
    )
    notificationGroups = notificationGroups.concat(
      map(groupedNotificationsByContractId, (notifications, contractId) => {
        const notificationsForContractId = groupedNotificationsByContractId[
          contractId
        ].sort((a, b) => {
          return b.createdTime - a.createdTime
        })
        // Create a notification group for each contract within each day
        const notificationGroup: NotificationGroup = {
          notifications: notificationsForContractId,
          groupedById: contractId,
          isSeen: notificationsForContractId.some((n) => !n.isSeen),
          timePeriod: day,
          type: 'normal',
        }
        return notificationGroup
      })
    )
  })
  return notificationGroups
}
