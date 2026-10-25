new Chart(document.getElementById('overallChart'), {
  type: 'pie',
  data: { labels:['Score','Remaining'], datasets:[{ data:[90,10] }] }
});

new Chart(document.getElementById('subjectChart'), {
  type: 'bar',
  data: {
    labels:['Math','English','Science','History'],
    datasets:[{ data:[60,65,92,88] }]
  }
});